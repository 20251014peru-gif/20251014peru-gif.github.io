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
  4) 중요도(red/orange/gray)를 '키워드 매칭'으로 즉시 표시  ※ AI 미사용
  5) 결과 저장:  news.json (표/리더뷰용)  +  glossary.json (용어집, 누적)

★ 비용 안내(중요):
  - 이 수집기는 더 이상 Claude(AI)를 호출하지 않습니다 → 자동수집을 켜둬도 결제가 발생하지 않습니다.
  - 요약 / 번역 / 질문은 사이트(news.html)에서 사용자가 버튼을 누를 때만 실행됩니다(=본 것만 소량 과금).

주의:
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
# ※ AI(요약·번역) 제거됨 — 수집기는 Claude를 호출하지 않습니다(수집 비용 0).
#    요약/번역/질문은 사이트(news.html)에서 필요할 때만 사용자가 실행합니다.
NTFY_TOPIC    = os.getenv("NTFY_TOPIC", "")   # ntfy 채널명(폰 알림). 비면 알림 건너뜀
NTFY_SERVER   = os.getenv("NTFY_SERVER", "https://ntfy.sh")
SITE_URL      = os.getenv("SITE_URL", "https://20251014peru-gif.github.io/news.html")  # 알림 누르면 열릴 사이트

# 관심 키워드 (사이트의 '관심 키워드'와 연동될 값. 우선 파일에서 읽고, 없으면 기본값)
# 항상 수집하는 핵심 고정 키워드 (달님 관심축: 반도체AI·2차전지·국내미국지수·거시)
CORE_KEYWORDS = [
    "금리", "연준", "환율", "CPI", "관세", "한국은행",
    "HBM", "AI반도체", "온디바이스AI", "2차전지", "전고체", "전력설비",
    "코스피", "코스닥", "나스닥", "외국인수급",
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
    # HUB 방식만 사용(뉴스 검색과 동일 인증). 구형 폴백은 헷갈리는 401을 유발해 제거.
    urls = [
        ("https://naverapihub.apigw.ntruss.com/search-trend/v1/search",
         {"X-NCP-APIGW-API-KEY-ID": NAVER_ID, "X-NCP-APIGW-API-KEY": NAVER_SECRET,
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
            print("  ! 데이터랩 실패:", chunk, "| 상태:", last[1])
            print("    응답:", last[2])
            print("    >> 해결: console.ncloud.com → NAVER API HUB → Application [수정] → '검색어 트렌드(Search Trend)' 체크")
            print("    (뉴스 검색은 되는데 트렌드만 401/429면, 이 API 선택이 누락된 것입니다)")
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
# 중요도 태깅 (AI 없이 키워드 매칭 — 무료·즉시)
#   red   : 속보/긴급/단독  또는  제목에 '핵심 고정 키워드'가 있음
#   orange: 제목에 '관심 키워드(핵심+급상승)'가 있음
#   gray  : 그 외
#   ※ 요약·번역은 하지 않습니다. 사이트에서 [요약]/[번역] 버튼으로 필요할 때만.
# ──────────────────────────────────────────────────────────────
_BREAK_PAT = re.compile(r"\[속보\]|\[긴급\]|\[단독\]|속보:|긴급:")

def tag_importance(item, watch, core):
    """제목의 키워드 포함 여부로 중요도(sig)·이유(reason)·대표키워드(matched)를 즉시 계산."""
    title = item.get("title", "") or ""
    breaking   = bool(_BREAK_PAT.search(title))
    core_hits  = [k for k in (core  or []) if k and k in title]
    watch_hits = [k for k in (watch or []) if k and k in title]
    if breaking or core_hits:
        sig = "red"
        reason = ("핵심 키워드: " + ", ".join(core_hits[:2])) if core_hits else "속보/긴급"
    elif watch_hits:
        sig, reason = "orange", "관심 키워드: " + watch_hits[0]
    else:
        sig, reason = "gray", ""
    matched = core_hits[0] if core_hits else (watch_hits[0] if watch_hits else item.get("kw", ""))
    return sig, reason, matched


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

def ntfy_push(title, message, url="", tags="", priority="default", actions=""):
    """ntfy로 폰 푸시. NTFY_TOPIC 없으면 조용히 건너뜀. actions=알림 버튼(선택)."""
    if not NTFY_TOPIC:
        return False
    try:
        h = {"Title": title.encode("utf-8"), "Priority": priority}
        if tags: h["Tags"] = tags
        if url:  h["Click"] = url            # 알림 본문 탭 = 이 URL
        if actions: h["Actions"] = actions   # 추가 버튼(예: 뉴스레이더에서 보기)
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
    if len(items) > 250:
        items = items[:250]  # 폭주 방지 상한(속도는 병렬+묶음으로 커버)
    print(f"고유 뉴스 {len(items)}건 → 본문 추출 + 중요도 태깅(AI 미사용)")

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

    # 중요도 태깅: AI 없이 키워드 매칭으로 즉시 판정 (요약·번역은 앱에서 수동)
    print(f"[2/2] 중요도 태깅(키워드 매칭) · 총 {len(items)}건 — AI 미사용(무료)", flush=True)

    for i, it in enumerate(items, 1):
        sig, reason, matched = tag_importance(it, keywords, CORE_KEYWORDS)
        out_news.append({
            "id": i,
            "date": (it.get("pub") or ""),   # 발행시각 원문 보존(파싱은 프론트에서)
            "src": it["src"],
            "origin": it.get("origin", ""),
            "kw": matched or it.get("kw", ""),
            "trans": it.get("trans", False),
            "title": it["title"],            # 번역 안 함(외신 원문 유지) → 앱에서 [번역] 버튼으로
            "orig_title": it["title"],
            "summary": "",                   # 자동요약 제거 → 앱에서 [요약] 버튼으로 필요할 때만
            "body": it["body"] or it.get("raw_summary", ""),
            "sig": sig,
            "reason": reason,
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
        # 검색 관심(데이터랩): 대중이 많이 찾는 경제·투자 키워드 (별도 파일)
        trend_terms = []
        try:
            with open("datalab_terms.json","r",encoding="utf-8") as f:
                dj=json.load(f)
                if isinstance(dj,list): trend_terms=dj
        except Exception:
            trend_terms = ["삼성전자","SK하이닉스","엔비디아","반도체","2차전지","전기차","코스피","환율","금리","비트코인","테슬라","AI"]
        trend_terms = trend_terms[:20]  # 데이터랩 쿼터 배려
        dl = fetch_datalab(trend_terms, days=14)
        if dl:
            # 최근 검색량(마지막 며칠 평균) 기준으로 순위 매기기
            def recent_score(v):
                r = [x for x in (v.get("ratios") or []) if isinstance(x,(int,float))]
                return sum(r[-3:])/max(1,len(r[-3:])) if r else 0
            ranked = sorted(dl.items(), key=lambda kv: recent_score(kv[1]), reverse=True)
            ordered = {}
            for rank,(name,v) in enumerate(ranked, 1):
                v["rank"] = rank
                v["score"] = round(recent_score(v),1)
                ordered[name] = v
            with open("trends.json", "w", encoding="utf-8") as f:
                json.dump({"updated": now.strftime("%Y-%m-%d %H:%M"), "data": ordered,
                           "order": [n for n,_ in ranked]}, f, ensure_ascii=False, indent=2)
            top5 = ", ".join(n for n,_ in ranked[:5])
            print(f"→ trends.json 저장됨 (대중 관심 {len(dl)}개, 인기순: {top5} …)")
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
            art_url = n.get("url","")
            # 알림 버튼: [원문 기사] [뉴스레이더]
            acts = []
            if art_url:
                acts.append("view, 원문 기사, %s" % art_url)
            acts.append("view, 뉴스레이더, %s" % SITE_URL)
            ntfy_push("🚨 속보 · " + (n.get("kw") or "뉴스레이더"),
                      n.get("title","") + "\n" + body,
                      url=art_url or SITE_URL, tags="rotating_light", priority="high",
                      actions="; ".join(acts))
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
