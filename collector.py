#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
뉴스레이더 - 1단계 수집기 (collector.py)
------------------------------------------------------------
하는 일:
  1) 관심 키워드마다 뉴스를 수집
       - 국내: 네이버 검색 API (news)  +  구글 뉴스 RSS(한국어)
       - 외신: 구글 뉴스 RSS(영어, 투자/경제/정치)
  2) 각 기사 원문 페이지에서 '본문 전체'를 추출 (전문 추출)
  3) 같은 뉴스는 1건으로 중복 제거 (제목 유사도)
  4) Claude가 한 번에:  (외신이면)한국어 번역 - 한 줄 요약 - 중요도(red/orange/gray)+이유 - 용어집 후보 추출
  5) 결과 저장:  news.json (표/리더뷰용)  +  glossary.json (용어집, 누적)

주의:
  - 이 스크립트는 API 키가 필요해서 이 대화창(샌드박스)에서는 실행 검증만 못 했어요.
    달님 PC(또는 클라우드)에서 아래 README 순서대로 키만 넣으면 돌아갑니다.
  - 개인용(나만 보기) 전제입니다. 추출한 본문을 외부에 공개 배포하지 마세요.
"""

import os
import re
import json
import time
import html
import difflib
import datetime as dt

import requests
import feedparser
import trafilatura

# ──────────────────────────────────────────────────────────────
# 설정 (환경변수로 키를 넣습니다. README 참고)
# ──────────────────────────────────────────────────────────────
NAVER_ID      = os.getenv("NAVER_ID", "")
NAVER_SECRET  = os.getenv("NAVER_SECRET", "")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

CLAUDE_MODEL  = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")   # 달님 표준. 필요시 최신 모델로 교체 가능
NTFY_TOPIC    = os.getenv("NTFY_TOPIC", "")   # ntfy 채널명(폰 알림). 비면 알림 건너뜀
NTFY_SERVER   = os.getenv("NTFY_SERVER", "https://ntfy.sh")
SITE_URL      = os.getenv("SITE_URL", "https://20251014peru-gif.github.io/news.html")  # 알림 누르면 열릴 사이트
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

# 관심 키워드 (사이트의 '관심 키워드'와 연동될 값. 우선 파일에서 읽고, 없으면 기본값)
# 항상 수집하는 핵심 고정 키워드 (달님 관심축: 반도체AI·2차전지·국내미국지수·거시)
CORE_KEYWORDS = [
    "반도체", "HBM", "엔비디아", "AI 반도체", "SK하이닉스", "삼성전자",
    "2차전지", "전기차", "코스피", "코스닥", "나스닥",
    "환율", "금리", "연준", "외국인 수급", "실적 발표",
]
DEFAULT_KEYWORDS = CORE_KEYWORDS

# 급상승(트렌드) 키워드를 매 실행마다 자동으로 몇 개 섞을지
TREND_ADD_COUNT = 5
# 트렌드에서 제외할 잡음(연예·스포츠 등 투자 무관 흔한 단어)
TREND_STOP = ["드라마","야구","축구","날씨","로또","연예","아이돌","예능","영화","웹툰","게임",
              "ai","mu","트럼프","날씨","경기","콘서트","티켓","시즌","방송","출연","배우","가수",
              "월드컵","올림픽","드라이브","맛집","여행","레시피","건강","다이어트"]
# 트렌드 키워드 최소 조건(투자 무관 잡음 컷)
import re as _re
def _trend_ok(t):
    t=(t or "").strip()
    if len(t)<2: return False
    if _re.fullmatch(r"[a-zA-Z]{1,3}", t): return False  # mu, ai 등 짧은 영문
    if any(s==t or s in t for s in TREND_STOP): return False
    return True

# 키워드당 가져올 개수
NAVER_PER_KW   = 8
GOOGLE_PER_KW  = 6
FOREIGN_PER_KW = 5

# 본문 최소 길이(이보다 짧으면 추출 실패로 간주 → 요약만 사용)
MIN_BODY_LEN = 200

HEADERS = {"User-Agent": "Mozilla/5.0 (NewsRadar/1.0)"}


# ──────────────────────────────────────────────────────────────
# 유틸
# ──────────────────────────────────────────────────────────────
def strip_tags(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s or "")
    return html.unescape(s).strip()

def norm_title(t: str) -> str:
    """중복 판단용 제목 정규화"""
    t = strip_tags(t).lower()
    t = re.sub(r"\[[^\]]*\]", " ", t)          # [속보] 등 제거
    t = re.sub(r"[^0-9a-z가-힣]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()

def fetch_trending(limit=5):
    """구글 트렌드 대한민국 실시간 급상승 검색어를 가져와 투자 무관 잡음은 걸러 반환."""
    url = "https://trends.google.com/trending/rss?geo=KR"
    try:
        d = feedparser.parse(url)
        out = []
        for e in d.entries:
            t = strip_tags(getattr(e, "title", "")).strip()
            if not t:
                continue
            if not _trend_ok(t):
                continue
            if t not in out:
                out.append(t)
            if len(out) >= limit:
                break
        return out
    except Exception as ex:
        print("  ! 트렌드 수집 실패:", ex)
        return []

def fetch_datalab(terms, days=14):
    """네이버 데이터랩 검색어 트렌드(일자별 상대지수 0~100)를 종목별로 조회해 dict 반환.
    terms: ["삼성전자","SK하이닉스",...]  →  {term: {"dates":[...], "ratios":[...]}}"""
    if not (NAVER_ID and NAVER_SECRET) or not terms:
        return {}
    import datetime as _dt
    end = _dt.date.today()
    start = end - _dt.timedelta(days=days)
    # 데이터랩은 그룹 최대 5개 → 5개씩 끊어서 호출
    urls = [
        ("https://naverapihub.apigw.ntruss.com/search-trend/v1/search",
         {"X-NCP-APIGW-API-KEY-ID": NAVER_ID, "X-NCP-APIGW-API-KEY": NAVER_SECRET,
          "Content-Type": "application/json"}),
        ("https://openapi.naver.com/v1/datalab/search",
         {"X-Naver-Client-Id": NAVER_ID, "X-Naver-Client-Secret": NAVER_SECRET,
          "Content-Type": "application/json"}),
    ]
    out = {}
    for i in range(0, len(terms), 5):
        chunk = terms[i:i+5]
        body = {
            "startDate": start.strftime("%Y-%m-%d"),
            "endDate": end.strftime("%Y-%m-%d"),
            "timeUnit": "date",
            "keywordGroups": [{"groupName": t, "keywords": [t]} for t in chunk],
        }
        ok = False
        for url, h in urls:
            try:
                r = requests.post(url, headers=h, data=json.dumps(body, ensure_ascii=False).encode("utf-8"), timeout=12)
                if r.status_code == 200:
                    for res in r.json().get("results", []):
                        name = res.get("title", "")
                        data = res.get("data", [])
                        out[name] = {
                            "dates": [d.get("period") for d in data],
                            "ratios": [d.get("ratio") for d in data],
                        }
                    ok = True
                    break
                else:
                    last = (url, r.status_code, r.text[:160])
            except Exception as e:
                last = (url, "예외", str(e))
        if not ok:
            print("  ! 데이터랩 실패:", chunk, "| 상태:", last[1], "| 응답:", last[2])
            print("    (HUB 콘솔에서 '검색어 트렌드/Search Trend' API가 선택됐는지 확인하세요)")
    return out

def load_keywords() -> list:
    try:
        with open("keywords.json", "r", encoding="utf-8") as f:
            kw = json.load(f)
            if isinstance(kw, list) and kw:
                return kw
    except Exception:
        pass
    return DEFAULT_KEYWORDS


# ──────────────────────────────────────────────────────────────
# 수집기
# ──────────────────────────────────────────────────────────────
def fetch_naver(keyword: str) -> list:
    """네이버 검색 API - 뉴스"""
    if not (NAVER_ID and NAVER_SECRET):
        return []
    params = {"query": keyword, "display": NAVER_PER_KW, "sort": "date"}
    # 두 가지 인증 방식을 순서대로 시도 (구형 오픈API / 신형 API HUB)
    attempts = [
        # 신형 NAVER API HUB (2026 이관, 지금 발급 키는 대부분 이것)
        ("https://naverapihub.apigw.ntruss.com/search/v1/news",
         {"X-NCP-APIGW-API-KEY-ID": NAVER_ID, "X-NCP-APIGW-API-KEY": NAVER_SECRET}),
        # 구형 개발자센터 (예전 키를 위한 폴백)
        ("https://openapi.naver.com/v1/search/news.json",
         {"X-Naver-Client-Id": NAVER_ID, "X-Naver-Client-Secret": NAVER_SECRET}),
    ]
    last = None
    for url, h in attempts:
        try:
            r = requests.get(url, params=params, headers=h, timeout=10)
            if r.status_code == 200:
                items = r.json().get("items", [])
                out = []
                for it in items:
                    out.append({
                        "src": "naver", "kw": keyword, "trans": False,
                        "title": strip_tags(it.get("title", "")),
                        "raw_summary": strip_tags(it.get("description", "")),
                        "url": it.get("originallink") or it.get("link", ""),
                        "pub": it.get("pubDate", ""),
                    })
                return out
            last = (url, r.status_code, r.text[:180])
        except Exception as e:
            last = (url, "예외", str(e))
    if last:
        print("  ! naver 실패:", keyword, "| 상태:", last[1], "| 응답:", last[2])
        print("    (키 이름이 Client ID/Secret 인지, API HUB에서 '뉴스' 검색이 활성인지 확인하세요. 구글 RSS 수집은 계속됩니다)")
    return []



def fetch_google_rss(keyword: str, lang="ko", region="KR", foreign=False) -> list:
    """구글 뉴스 RSS. 한국어/영어 로케일 지원."""
    if lang == "ko":
        ceid, hl, gl, q = "KR:ko", "ko", "KR", keyword
    else:
        ceid, hl, gl, q = "US:en", "en-US", "US", keyword
    q_enc = requests.utils.quote(q)
    url = f"https://news.google.com/rss/search?q={q_enc}&hl={hl}&gl={gl}&ceid={ceid}"
    limit = FOREIGN_PER_KW if foreign else GOOGLE_PER_KW
    try:
        feed = feedparser.parse(url)
    except Exception as e:
        print("  ! google rss 실패:", keyword, e)
        return []
    out = []
    for e in feed.entries[:limit]:
        out.append({
            "src": "foreign" if foreign else "google",
            "kw": keyword, "trans": bool(foreign),
            "title": strip_tags(getattr(e, "title", "")),
            "raw_summary": strip_tags(getattr(e, "summary", "")),
            "url": getattr(e, "link", ""),
            "pub": getattr(e, "published", ""),
            "origin": (getattr(e, "source", {}) or {}).get("title", "외신") if foreign else "",
        })
    return out


def extract_body(url: str) -> str:
    """원문 페이지에서 본문 추출. requests 타임아웃(8초)만 사용 → 무한대기 방지."""
    if not url:
        return ""
    try:
        r = requests.get(url, headers=HEADERS, timeout=8)
        body = trafilatura.extract(
            r.text or "", include_comments=False, include_tables=False, favor_recall=True
        )
        if body and len(body) >= MIN_BODY_LEN:
            return body.strip()
    except Exception:
        pass
    return ""


def dedupe(items: list) -> list:
    """제목 유사도로 같은 뉴스 묶기. dupes = 묶인 언론사 수."""
    kept = []
    for it in items:
        nt = norm_title(it["title"])
        matched = None
        for k in kept:
            if difflib.SequenceMatcher(None, nt, k["_nt"]).ratio() >= 0.72:
                matched = k
                break
        if matched:
            matched["dupes"] += 1
            # 국내 우선, 본문 있는 쪽 우선 유지
            continue
        it["_nt"] = nt
        it["dupes"] = 1
        kept.append(it)
    for k in kept:
        k.pop("_nt", None)
    return kept


# ──────────────────────────────────────────────────────────────
# Claude 처리 (번역·요약·중요도·용어)
# ──────────────────────────────────────────────────────────────
ENRICH_SYS = (
    "너는 개인 뉴스 대시보드의 편집자다. 입력 기사에 대해 한국어로 아래 JSON만 출력한다. "
    "설명·마크다운·코드펜스 없이 순수 JSON만."
)

def enrich_prompt(item, keywords):
    body = (item.get("body") or item.get("raw_summary") or "")[:6000]
    return (
        "다음 기사를 처리해줘.\n"
        f"[제목] {item['title']}\n"
        f"[출처] {item.get('origin') or item['src']}\n"
        f"[본문]\n{body}\n\n"
        f"관심 키워드 목록: {', '.join(keywords)}\n\n"
        "요구사항:\n"
        "1) title_ko: (외신이면) 제목을 자연스러운 한국어로 번역, 국내면 그대로.\n"
        "2) summary: 핵심을 한 줄(35자 내외)로 요약.\n"
        "3) importance: 'red'(꼭 봐야 함)/'orange'(주목)/'gray'(일반) 중 하나. "
        "관심 키워드에 정확히 걸리거나 시장에 큰 영향이면 red.\n"
        "4) reason: 그 중요도로 판단한 이유 한 줄.\n"
        "5) matched_kw: 이 기사와 가장 맞는 관심 키워드 하나(없으면 가장 근접한 것).\n"
        "6) glossary: 기사에 나온 '전문 용어'만 최대 3개 (없으면 빈 배열). 각 {term, def(1줄 쉬운 설명)}.\n"
   "   [포함] 반도체·IT·에너지·2차전지 등 산업 기술용어, 금융·경제·투자 전문용어, 제품/규격/기관 약어"
   " (예: HBM, 파운드리, CXL, 온디바이스AH, 폼팩터, EUV, 전고체, ESS, 스왑, 베이시스, 컨센서스, 듀레이션, CAPEX, MLCC).\n"
   "   [제외] 일반 명사·시사 단어·행위/상태어는 절대 넣지 마 "
   "(단독으로 쓰인 일반어 예: 단독, 동맹, 세수, 압박, 회동, 급등, 기대, 실적, 목표 등은 제외).\n"
   "   단, 여러 단어로 된 산업·정책 고유표현은 포함 (예: 반도체 클러스터, 전략 개발 계약, 미래대응기금, 소부장, 온디바이스 AI).\n"
   "   판단 기준: '그 분야를 모르면 사전을 찾아야 하는 용어'만. 일반 뉴스 단어면 넣지 마.\n"
        '반드시 이 형태의 JSON만:\n'
        '{"title_ko":"","summary":"","importance":"gray","reason":"","matched_kw":"","glossary":[{"term":"","def":""}]}'
    )

def claude_enrich(item, keywords):
    if not ANTHROPIC_KEY:
        # 키 없으면 원본으로 대체 (테스트용)
        return {
            "title_ko": item["title"],
            "summary": (item.get("raw_summary") or "")[:40],
            "importance": "gray", "reason": "AI 미설정",
            "matched_kw": item.get("kw", ""), "glossary": []
        }
    payload = {
        "model": CLAUDE_MODEL, "max_tokens": 700,
        "system": ENRICH_SYS,
        "messages": [{"role": "user", "content": enrich_prompt(item, keywords)}],
    }
    h = {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    try:
        r = requests.post(ANTHROPIC_URL, headers=h, json=payload, timeout=40)
        r.raise_for_status()
        data = r.json()
        text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
        m = re.search(r"\{.*\}", text, re.S)
        return json.loads(m.group(0)) if m else {}
    except Exception as e:
        print("  ! claude 실패:", e)
        return {
            "title_ko": item["title"], "summary": (item.get("raw_summary") or "")[:40],
            "importance": "gray", "reason": "AI 오류", "matched_kw": item.get("kw", ""),
            "glossary": []
        }


# ──────────────────────────────────────────────────────────────

# 용어집 품질 필터: 일반어/시사어는 버리고 전문용어만 통과
GLOSS_BLOCK = set("""
단독 동맹 세수 압박 회동 급등 급락 기대 협력 논의 추진 전략 개발 계약 실적 목표 확대 축소
반등 하락 상승 강세 약세 전망 성장 투자 지원 정책 규제 발표 예정 계획 검토 우려 호재 악재
현안 이슈 관련 최대 최고 최저 신설 조성 유치 수혜 부담 완화 강화 도입 시행 결정 방침 입장
""".split())

def is_specialized(term: str) -> bool:
    t = (term or "").strip()
    if not t:
        return False
    if t in GLOSS_BLOCK:
        return False
    # 한 글자/두 글자 한글 일반어는 대개 전문용어 아님 (약어 영문은 허용)
    if re.fullmatch(r"[가-힣]{1,2}", t):
        return False
    # 순수 숫자/조사 섞인 잡토큰 제외
    if re.fullmatch(r"[0-9%\s]+", t):
        return False
    # 통과: 영문/숫자 포함 약어(HBM, EUV, CXL), 또는 3글자 이상 한글 전문어
    return True


# 용어집 누적 병합
# ──────────────────────────────────────────────────────────────
def load_glossary():
    try:
        with open("glossary.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def ntfy_push(title, message, url="", tags="", priority="default"):
    """ntfy로 폰 푸시. NTFY_TOPIC 없으면 조용히 건너뜀."""
    if not NTFY_TOPIC:
        return False
    try:
        h = {"Title": title.encode("utf-8"), "Priority": priority}
        if tags: h["Tags"] = tags
        if url:  h["Click"] = url
        r = requests.post(f"{NTFY_SERVER}/{NTFY_TOPIC}",
                          data=message.encode("utf-8"), headers=h, timeout=10)
        return r.status_code < 300
    except Exception as e:
        print("  ! ntfy 푸시 실패:", e)
        return False

def save_glossary(gl):
    with open("glossary.json", "w", encoding="utf-8") as f:
        json.dump(gl, f, ensure_ascii=False, indent=2)


# ──────────────────────────────────────────────────────────────
# 메인
# ──────────────────────────────────────────────────────────────
def claude_enrich_batch(items, keywords, size=8):
    """여러 기사를 묶어서 한 번에 처리 → 호출 수 대폭 감소. 실패 시 개별 폴백."""
    results = [None]*len(items)
    if not ANTHROPIC_KEY:
        for i,it in enumerate(items): results[i]=claude_enrich(it,keywords)
        return results
    kwline = ", ".join(keywords)
    for s in range(0, len(items), size):
        chunk = items[s:s+size]
        lines=[]
        for j,it in enumerate(chunk):
            body=(it.get("body") or it.get("raw_summary") or "")[:1500]
            lines.append(f'#{j} 제목:{it["title"]}\n출처:{it.get("origin") or it["src"]}\n본문:{body}')
        prompt=("아래 여러 기사를 각각 처리해 JSON 배열로만 답해. 설명·코드펜스 금지.\n"
                f"관심 키워드: {kwline}\n\n"+"\n\n".join(lines)+"\n\n"
                '각 원소: {"i":번호,"title_ko":"","summary":"35자요약","importance":"red|orange|gray","reason":"","matched_kw":"","glossary":[{"term":"","def":""}]}\n'
                "importance: 관심 키워드에 정확히 걸리거나 시장 영향 크면 red, 주목 orange, 일반 gray.\n"
                "glossary: 전문용어(반도체·금융·산업 약어/규격)만 최대2개, 일반어 금지. 없으면 [].\n"
                "반드시 JSON 배열([ 로 시작 ] 로 끝)만.")
        payload={"model":CLAUDE_MODEL,"max_tokens":3000,"system":ENRICH_SYS,
                 "messages":[{"role":"user","content":prompt}]}
        h={"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"}
        parsed=None
        try:
            r=requests.post(ANTHROPIC_URL,headers=h,json=payload,timeout=60)
            r.raise_for_status()
            text="".join(b.get("text","") for b in r.json().get("content",[]) if b.get("type")=="text")
            m=re.search(r"\[.*\]",text,re.S)
            if m:
                arr=json.loads(m.group(0))
                parsed={int(o.get("i",k)):o for k,o in enumerate(arr)}
        except Exception as e:
            print("  ! 묶음 처리 실패, 개별 폴백:", e)
        for j,it in enumerate(chunk):
            if parsed and j in parsed:
                results[s+j]=parsed[j]
            else:
                results[s+j]=claude_enrich(it,keywords)  # 폴백
        _dn=min(s+size,len(items)); print(f"[2/2] AI 처리 {_dn}/{len(items)} ({round(_dn/len(items)*100)}%) · 남은 {len(items)-_dn}건", flush=True)
    return results


def main():
    core = load_keywords()
    trending = fetch_trending(TREND_ADD_COUNT)
    # 핵심 고정 + 급상승 자동 추가 (중복 제거, 순서 유지)
    keywords = list(dict.fromkeys(core + trending))
    print("핵심 키워드:", core)
    if trending:
        print("🔥 급상승 자동 추가:", trending)
    else:
        print("(급상승 키워드 없음 — 핵심만 수집)")
    print("이번 수집 키워드:", keywords)

    raw = []
    for kw in keywords:
        print("· 수집:", kw)
        raw += fetch_naver(kw)
        raw += fetch_google_rss(kw, lang="ko")
        raw += fetch_google_rss(kw, lang="en", foreign=True)
        time.sleep(0.3)

    print(f"수집 원본 {len(raw)}건 → 중복 제거 중")
    items = dedupe(raw)
    if len(items) > 120:
        items = items[:120]  # 폭주 방지 상한
    print(f"고유 뉴스 {len(items)}건 → 본문 추출 + AI 처리")

    glossary = load_glossary()
    now = dt.datetime.utcnow() + dt.timedelta(hours=9)  # KST 고정(Actions는 UTC)
    out_news = []

    # 본문 추출: 병렬(타임아웃 8초) → 느린 URL이 전체를 막지 않음
    from concurrent.futures import ThreadPoolExecutor
    total = len(items)
    print(f"[1/2] 본문 추출(병렬) 0/{total} …", flush=True)
    bodies = [""]*total
    done = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(extract_body, it["url"]): idx for idx, it in enumerate(items)}
        from concurrent.futures import as_completed
        for fut in as_completed(futs):
            idx = futs[fut]
            try: bodies[idx] = fut.result()
            except Exception: bodies[idx] = ""
            done += 1
            if done % 10 == 0 or done == total:
                print(f"[1/2] 본문 추출 {done}/{total} ({round(done/total*100)}%)", flush=True)
    for it, b in zip(items, bodies):
        it["body"] = b

    # AI: 8건씩 묶음 처리 → 호출 수 1/8, 훨씬 빠름
    print(f"[2/2] AI 처리(묶음) 시작 · 총 {len(items)}건", flush=True)
    infos = claude_enrich_batch(items, keywords, size=8)

    for i, it in enumerate(items, 1):
        info = infos[i-1] or {}

        for g in info.get("glossary", []):
            term = (g.get("term") or "").strip()
            if term and is_specialized(term) and term not in glossary:
                glossary[term] = {"def": g.get("def", ""), "first_seen": now.strftime("%Y-%m-%d")}

        out_news.append({
            "id": i,
            "date": (it.get("pub") or ""),   # 발행시각 원문 보존(파싱은 프론트에서)
            "src": it["src"],
            "origin": it.get("origin", ""),
            "kw": info.get("matched_kw") or it.get("kw", ""),
            "trans": it.get("trans", False),
            "title": info.get("title_ko") or it["title"],
            "orig_title": it["title"],
            "summary": info.get("summary", ""),
            "body": it["body"] or it.get("raw_summary", ""),
            "sig": info.get("importance", "gray"),
            "reason": info.get("reason", ""),
            "dupes": it.get("dupes", 1),
            "url": it["url"],
            "read": False, "scrap": False, "breaking": "속보" in it["title"],
            "collected_at": now.strftime("%Y-%m-%d %H:%M"),
        })

    # ── 날짜별 저장 + 중복(같은 url) skip ──
    today = now.strftime("%Y-%m-%d")
    os.makedirs("archive", exist_ok=True)
    arch_path = os.path.join("archive", today + ".json")
    try:
        with open(arch_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
    except Exception:
        existing = []
    seen = set(x.get("url") for x in existing if x.get("url"))
    added = 0
    new_added = []
    for n in out_news:
        if n.get("url") and n["url"] in seen:
            continue
        existing.append(n); seen.add(n.get("url")); added += 1; new_added.append(n)
    # id 재부여
    for i, x in enumerate(existing, 1):
        x["id"] = i

    with open(arch_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)
    # 메인(news.json) = 오늘 것 전체
    with open("news.json", "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)
    # ── 네이버 데이터랩: 종목 검색어 트렌드 → trends.json ──
    try:
        trend_terms = list(core)
        try:
            with open("stocks.json","r",encoding="utf-8") as f:
                sj=json.load(f)
                if isinstance(sj,list):
                    for s in sj:
                        if s not in trend_terms: trend_terms.append(s)
        except Exception:
            pass
        trend_terms = trend_terms[:20]  # 데이터랩 쿼터 배려
        dl = fetch_datalab(trend_terms, days=14)
        if dl:
            with open("trends.json", "w", encoding="utf-8") as f:
                json.dump({"updated": now.strftime("%Y-%m-%d %H:%M"), "data": dl}, f, ensure_ascii=False, indent=2)
            print(f"→ trends.json 저장됨 (검색어 트렌드 {len(dl)}개)")
    except Exception as e:
        print("  ! trends.json 저장 건너뜀:", e)

    save_glossary(glossary)

    reds = sum(1 for n in existing if n["sig"] == "red")
    print(f"\n완료 · 새로 {added}건 추가 · 오늘 누적 {len(existing)}건 (중요 {reds}건) · 용어집 {len(glossary)}개")
    print(f"→ news.json / {arch_path} / glossary.json 저장됨")

    # ── 폰 푸시(ntfy) ──
    if NTFY_TOPIC and new_added:
        reds_new = [n for n in new_added if n.get("sig") == "red"]
        # (1) 진짜 속보만 개별 푸시: 제목에 속보/긴급 표시가 있는 red만 (도배 방지)
        import re as _re2
        _pat = _re2.compile(r"\[속보\]|\[긴급\]|\[단독\]|속보:|긴급:")
        breaking_new = [n for n in new_added
                        if n.get("breaking") or _pat.search((n.get("orig_title","")+n.get("title","")))]
        for n in breaking_new[:5]:
            body = n.get("summary") or n.get("title","")
            ntfy_push("🚨 속보 · " + (n.get("kw") or "뉴스레이더"),
                      n.get("title","") + "\n" + body,
                      url=n.get("url",""), tags="rotating_light", priority="high")
        # (2) 수집 완료 알림: 새 뉴스 있을 때만, 매 회차 1건 (확실히 도착)
        hhmm = now.strftime("%H:%M")
        titles = [("🔴 " if n.get("sig")=="red" else "· ") + n.get("title","") for n in new_added[:6]]
        more = ("\n…외 %d건" % (len(new_added)-6)) if len(new_added) > 6 else ""
        title = f"✅ 수집 완료 {hhmm} · 새 뉴스 {len(new_added)}건"
        if reds_new:
            title += f" (🔴 중요 {len(reds_new)})"
        ntfy_push(title, "\n".join(titles) + more, url=SITE_URL, tags="white_check_mark", priority="default")
        print(f"→ ntfy 푸시: 속보 {min(len(breaking_new),5)}건 + 완료알림 1건 (채널 {NTFY_TOPIC})")
    elif not NTFY_TOPIC:
        print("  · ntfy 푸시 건너뜀 (NTFY_TOPIC 미설정)")


if __name__ == "__main__":
    main()
