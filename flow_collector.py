# -*- coding: utf-8 -*-
# 흐름지도(flow) 수집기
# v 20260902-0530
#
# 하는 일 : 경제 유튜브 채널의 최근 영상을 모아 → 쇼츠/라이브를 걸러내고 → 주제별로 묶어
#           주제 카드를 갱신하고 → 변경 이력을 남기고 → 급증하면 폰으로 알립니다.
# 안 하는 일: AI 호출을 하지 않습니다(= 자동 실행 무료). 자막 분석은 화면(flow.html)에서 합니다.
#
# 구역 : ①설정 ②수집 ③분석 ④저장 ⑤알림  — ③은 화면을 전혀 모릅니다.
#        숫자·단어를 고칠 일이 있으면 flow_channels.json 만 고치세요. 이 파일은 안 건드려도 됩니다.

import os
import re
import sys
import json
import time
import statistics
from datetime import datetime, timedelta, timezone

import requests

# ─────────────────────────────────────────────────────────────
# ① 설정
# ─────────────────────────────────────────────────────────────

KST = timezone(timedelta(hours=9))

CONF_FILE    = "flow_channels.json"   # 설정(사람이 고치는 것)
STATE_FILE   = "flow_state.json"      # 핸들→채널ID 캐시 (할당량 절약)
OUT_FILE     = "flow.json"            # 오늘 수집 결과
TOPICS_FILE  = "flow_topics.json"     # 주제 카드 현재 상태
HISTORY_FILE = "flow_history.json"    # 변경 이력 — 절대 지우지 않습니다

API = "https://www.googleapis.com/youtube/v3"
YT_KEY     = os.environ.get("YT_API_KEY", "").strip()
NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "").strip()
RUN_MODE   = os.environ.get("RUN_MODE", "brief").strip()   # brief(아침) | watch(긴급감지)

quota_used = 0


def kst_now():
    """항상 KST. datetime.now() 를 직접 쓰지 않습니다."""
    return datetime.now(KST)


def log(msg):
    print(f"[{kst_now().strftime('%m-%d %H:%M')}] {msg}", flush=True)


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default
    except Exception as e:
        log(f"⚠️ {path} 읽기 실패 → 기본값 사용: {e}")
        return default


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


# ─────────────────────────────────────────────────────────────
# ② 수집
# ─────────────────────────────────────────────────────────────

def api_get(endpoint, params, cost=1):
    """유튜브 API 호출. 실패해도 예외를 던지지 않고 None 을 돌려줍니다(한 채널 때문에 전체가 죽지 않도록)."""
    global quota_used
    params = dict(params)
    params["key"] = YT_KEY
    try:
        r = requests.get(f"{API}/{endpoint}", params=params, timeout=20)
        quota_used += cost
        if r.status_code != 200:
            log(f"⚠️ {endpoint} {r.status_code}: {r.text[:200]}")
            return None
        return r.json()
    except Exception as e:
        log(f"⚠️ {endpoint} 예외: {e}")
        return None


def resolve_channels(channels, state):
    """핸들/채널ID → 업로드 재생목록ID. 한 번 찾으면 flow_state.json 에 캐시해 다시 안 부릅니다."""
    cache = state.setdefault("uploads", {})
    resolved = []

    for ch in channels:
        key = ch.get("cid") or ch.get("handle")
        if not key:
            log(f"⚠️ {ch['name']}: cid·handle 이 둘 다 없음 → 건너뜀")
            continue

        if key in cache:
            ch = dict(ch, cid=cache[key]["cid"], uploads=cache[key]["uploads"])
            resolved.append(ch)
            continue

        if ch.get("cid"):
            data = api_get("channels", {"part": "contentDetails", "id": ch["cid"]})
        else:
            data = api_get("channels", {"part": "contentDetails", "forHandle": ch["handle"]})

        items = (data or {}).get("items") or []
        if not items:
            log(f"⚠️ {ch['name']}: 채널을 찾지 못함 ({key}) → 건너뜀")
            continue

        cid = items[0]["id"]
        uploads = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]
        cache[key] = {"cid": cid, "uploads": uploads, "name": ch["name"]}
        ch = dict(ch, cid=cid, uploads=uploads)
        resolved.append(ch)
        log(f"  · 해석 {ch['name']} → {cid}")

    return resolved


def fetch_recent_ids(ch, max_items):
    """업로드 재생목록에서 최근 영상 ID를 가져옵니다."""
    data = api_get("playlistItems", {
        "part": "contentDetails",
        "playlistId": ch["uploads"],
        "maxResults": min(max_items, 50),
    })
    items = (data or {}).get("items") or []
    return [it["contentDetails"]["videoId"] for it in items if it.get("contentDetails", {}).get("videoId")]


def fetch_video_details(video_ids):
    """영상 상세를 50개씩 묶어 가져옵니다(1회 1유닛)."""
    out = []
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i:i + 50]
        data = api_get("videos", {
            "part": "snippet,contentDetails,statistics,liveStreamingDetails",
            "id": ",".join(chunk),
            "maxResults": 50,
        })
        out.extend((data or {}).get("items") or [])
    return out


# ─────────────────────────────────────────────────────────────
# ③ 분석  ← 화면(flow.html)을 전혀 모릅니다
# ─────────────────────────────────────────────────────────────

DUR_RE = re.compile(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?")


def parse_duration(iso):
    """ISO8601(PT12M30S) → 초"""
    m = DUR_RE.fullmatch(iso or "")
    if not m:
        return 0
    d, h, mi, s = (int(x) if x else 0 for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def parse_published(iso):
    return datetime.fromisoformat((iso or "").replace("Z", "+00:00")).astimezone(KST)


def tag_topics(text, keywords):
    """제목+설명에서 키워드를 찾아 주제 태그를 붙입니다. 사전 기반이라 결과를 눈으로 검산할 수 있습니다."""
    low = text.lower()
    hits = []
    for topic, words in keywords.items():
        for w in words:
            if w.lower() in low:
                hits.append(topic)
                break
    return hits


def build_videos(raw_items, ch, st):
    """원시 응답 → 우리 형식. 쇼츠·라이브는 여기서 걸러냅니다."""
    now = kst_now()
    cutoff = now - timedelta(hours=st["lookback_hours"])
    kept, longform_views = [], []

    for it in raw_items:
        sn = it.get("snippet", {})
        cd = it.get("contentDetails", {})
        stt = it.get("statistics", {})

        dur = parse_duration(cd.get("duration"))
        is_short = dur <= st["shorts_max_seconds"]
        live = sn.get("liveBroadcastContent", "none")
        views = int(stt.get("viewCount", 0) or 0)

        # 채널 중앙값의 분모는 쇼츠를 뺀 롱폼만 — 설정 파일 _rule_median 참조
        if not is_short and live == "none":
            longform_views.append(views)

        if is_short:
            continue
        if st["live_exclude"] and live in ("live", "upcoming"):
            continue

        pub = parse_published(sn.get("publishedAt"))
        if pub < cutoff:
            continue

        hours = max((now - pub).total_seconds() / 3600, 0.5)
        kept.append({
            "id": it["id"],
            "title": sn.get("title", ""),
            "desc": (sn.get("description", "") or "")[:1500],
            "channel": ch["name"],
            "channel_id": ch["cid"],
            "group": ch.get("group", ""),
            "weight": ch.get("weight", 1.0),
            "published": pub.isoformat(),
            "hours_ago": round(hours, 1),
            "duration_sec": dur,
            "views": views,
            "likes": int(stt.get("likeCount", 0) or 0),
            "comments": int(stt.get("commentCount", 0) or 0),
            "url": f"https://www.youtube.com/watch?v={it['id']}",
            "thumb": (sn.get("thumbnails", {}).get("medium", {}) or {}).get("url", ""),
        })

    median = statistics.median(longform_views) if longform_views else 0
    for v in kept:
        v["vph"] = round(v["views"] / v["hours_ago"], 1)
        v["ch_median"] = median
        v["ch_multiple"] = round(v["views"] / median, 2) if median > 0 else 0
        v["engage"] = round((v["likes"] + v["comments"]) / v["views"], 4) if v["views"] > 0 else 0
    return kept


def group_by_topic(videos, keywords, st):
    """주제 사전으로 영상을 묶습니다. min_topic_videos 개 미만이면 주제로 세우지 않습니다."""
    buckets = {}
    for v in videos:
        v["topics"] = tag_topics(f"{v['title']} {v['desc']}", keywords)
        for t in v["topics"]:
            buckets.setdefault(t, []).append(v)

    topics = []
    for name, vids in buckets.items():
        if len(vids) < st["min_topic_videos"]:
            continue
        vids = sorted(vids, key=lambda x: x["published"], reverse=True)
        topics.append({
            "id": re.sub(r"[^0-9A-Za-z가-힣]", "_", name),
            "name": name,
            "video_count": len(vids),
            "channel_count": len({v["channel"] for v in vids}),
            "total_views": sum(v["views"] for v in vids),
            "latest": vids[0]["published"],
            "video_ids": [v["id"] for v in vids],
            "channels": sorted({v["channel"] for v in vids}),
        })
    return sorted(topics, key=lambda t: (t["channel_count"], t["video_count"]), reverse=True)


def detect_alerts(videos, topics, st):
    """짧은 시간에 한 주제로 영상이 몰리면 = 뭔가 터진 것."""
    win = st["alert_window_hours"]
    alerts = []
    for t in topics:
        recent = [vid for vid in videos if vid["id"] in t["video_ids"] and vid["hours_ago"] <= win]
        if len(recent) >= st["alert_min_videos"]:
            alerts.append({
                "topic": t["name"],
                "count": len(recent),
                "window_hours": win,
                "channels": sorted({v["channel"] for v in recent}),
                "at": kst_now().isoformat(),
            })
    return alerts


def diff_topics(old_topics, new_topics):
    """어제 대비 무엇이 바뀌었는지. 이 기록이 '흐름'의 원료입니다."""
    old = {t["name"]: t for t in old_topics}
    new = {t["name"]: t for t in new_topics}
    changes = []

    for name, t in new.items():
        if name not in old:
            changes.append({"type": "신규", "topic": name,
                            "detail": f"주제 등장 (영상 {t['video_count']}개 / 채널 {t['channel_count']}곳)"})
        else:
            d = t["channel_count"] - old[name]["channel_count"]
            if d != 0:
                changes.append({"type": "확산" if d > 0 else "축소", "topic": name,
                                "detail": f"채널 {old[name]['channel_count']}곳 → {t['channel_count']}곳 ({d:+d})"})

    for name in old:
        if name not in new:
            changes.append({"type": "소멸", "topic": name, "detail": "24~48시간 내 신규 영상 없음"})

    return changes


# ─────────────────────────────────────────────────────────────
# ④ 저장
# ─────────────────────────────────────────────────────────────

def save_all(videos, topics, alerts, changes, prev_out):
    stamp = kst_now().isoformat()

    # 빈 데이터로 덮어쓰기 가드 — 수집이 실패했는데 기존 결과를 지워버리면 안 됩니다
    if not videos and (prev_out.get("videos")):
        log("🛑 수집 0건인데 기존 결과가 있음 → 덮어쓰기 거부 (파일 보존)")
        return False

    save_json(OUT_FILE, {
        "_version": "v 20260902-0530",
        "generated_at": stamp,
        "mode": RUN_MODE,
        "quota_used": quota_used,
        "video_count": len(videos),
        "topic_count": len(topics),
        "videos": videos,
        "topics": topics,
        "alerts": alerts,
        "changes": changes,
    })
    save_json(TOPICS_FILE, {"updated_at": stamp, "topics": topics})

    hist = load_json(HISTORY_FILE, {"entries": []})
    for c in changes:
        hist["entries"].append(dict(c, at=stamp))
    for a in alerts:
        hist["entries"].append({"type": "긴급", "topic": a["topic"],
                                "detail": f"{a['window_hours']}시간 내 영상 {a['count']}개 급증", "at": stamp})
    save_json(HISTORY_FILE, hist)   # 절대 자르지 않습니다
    return True


# ─────────────────────────────────────────────────────────────
# ⑤ 알림
# ─────────────────────────────────────────────────────────────

def notify(title, body):
    if not (NTFY_TOPIC and title):
        return
    try:
        requests.post(f"https://ntfy.sh/{NTFY_TOPIC}",
                      data=body.encode("utf-8"),
                      headers={"Title": title.encode("utf-8"), "Priority": "default"},
                      timeout=10)
    except Exception as e:
        log(f"⚠️ ntfy 실패(무시): {e}")


# ─────────────────────────────────────────────────────────────
# 실행
# ─────────────────────────────────────────────────────────────

def main():
    if not YT_KEY:
        log("🛑 YT_API_KEY 가 없습니다. GitHub Secrets 에 등록하세요.")
        sys.exit(1)

    conf = load_json(CONF_FILE, None)
    if not conf:
        log(f"🛑 {CONF_FILE} 을 읽지 못했습니다.")
        sys.exit(1)

    st = conf["settings"]
    keywords = conf["keywords"]
    state = load_json(STATE_FILE, {})
    prev_out = load_json(OUT_FILE, {})
    prev_topics = load_json(TOPICS_FILE, {}).get("topics", [])

    targets = [c for c in conf["channels"]
               if c.get("track") in st["use_tracks"] and c.get("tier") in st["use_tiers"]]
    log(f"▶ {RUN_MODE} 모드 · 대상 채널 {len(targets)}개 (tier {st['use_tiers']})")

    channels = resolve_channels(targets, state)
    save_json(STATE_FILE, state)

    all_videos = []
    for ch in channels:
        ids = fetch_recent_ids(ch, st["max_videos_per_channel"])
        if not ids:
            continue
        raw = fetch_video_details(ids)
        vids = build_videos(raw, ch, st)
        all_videos.extend(vids)
        if vids:
            log(f"  · {ch['name']}: {len(vids)}개")
        time.sleep(0.05)

    all_videos.sort(key=lambda v: v["published"], reverse=True)
    topics = group_by_topic(all_videos, keywords, st)
    alerts = detect_alerts(all_videos, topics, st)
    changes = diff_topics(prev_topics, topics)

    ok = save_all(all_videos, topics, alerts, changes, prev_out)

    log(f"◀ 영상 {len(all_videos)}개 · 주제 {len(topics)}개 · 변경 {len(changes)}건 · "
        f"긴급 {len(alerts)}건 · 할당량 {quota_used}유닛 · 저장 {'완료' if ok else '거부'}")

    if st.get("ntfy_enabled"):
        if alerts:
            lines = [f"· {a['topic']}: {a['window_hours']}h 내 영상 {a['count']}개" for a in alerts]
            notify("🚨 흐름지도 급증 감지", "\n".join(lines))
        elif RUN_MODE == "brief" and changes:
            lines = [f"· [{c['type']}] {c['topic']} — {c['detail']}" for c in changes[:5]]
            notify(f"📊 흐름지도 아침 브리핑 (주제 {len(topics)})", "\n".join(lines))


if __name__ == "__main__":
    main()
