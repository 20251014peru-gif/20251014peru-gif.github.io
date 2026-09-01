# -*- coding: utf-8 -*-
# 자막 확보 가능성 실험 — v 20260902-0800
#
# 목적: GitHub Actions(클라우드 IP)에서 유튜브 자막을 가져올 수 있는지 딱 한 번 확인합니다.
#       결과에 따라 AI 분석 설계가 갈립니다. 확인 끝나면 이 파일과 flow-test.yml 은 지워도 됩니다.
#
# 아무것도 저장하지 않습니다. 로그만 찍습니다.

import json
import sys

print("=" * 60)
print(" 자막 확보 실험")
print("=" * 60)

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except Exception as e:
    print(f"🛑 라이브러리 로드 실패: {e}")
    sys.exit(0)

try:
    data = json.load(open("flow.json", encoding="utf-8"))
    vids = data.get("videos", [])
except Exception as e:
    print(f"🛑 flow.json 을 읽지 못했습니다: {e}")
    sys.exit(0)

if not vids:
    print("🛑 flow.json 에 영상이 없습니다. 수집을 먼저 돌려주세요.")
    sys.exit(0)

# 롱폼 위주로 5개만 시험합니다
targets = [v for v in vids if v.get("duration_sec", 0) > 300][:5]
if not targets:
    targets = vids[:5]

ok = 0
for i, v in enumerate(targets, 1):
    vid = v["id"]
    print(f"\n[{i}] {v['channel']} — {v['title'][:38]}")
    print(f"    {v['url']}  ({v.get('duration_sec',0)//60}분)")
    try:
        api = YouTubeTranscriptApi()
        # 한국어 → 자동생성 한국어 → 영어 순으로 시도
        tr = api.fetch(vid, languages=["ko", "en"])
        chunks = tr.to_raw_data() if hasattr(tr, "to_raw_data") else list(tr)
        text = " ".join(c["text"] for c in chunks)
        print(f"    ✅ 성공 — 조각 {len(chunks)}개 / 글자 {len(text)}자")
        print(f"    앞부분: {text[:110]}...")
        ok += 1
    except Exception as e:
        name = type(e).__name__
        msg = str(e).split("\n")[0][:160]
        print(f"    ❌ 실패 [{name}] {msg}")

print("\n" + "=" * 60)
print(f" 결과: {len(targets)}개 중 {ok}개 성공")
if ok == len(targets):
    print(" ✅ 자막 확보 가능 → 논리 4칸 전부 측정하는 설계로 갑니다")
elif ok > 0:
    print(" 🟡 일부만 성공 → 자막 있는 영상만 정밀분석, 나머지는 제목·설명으로")
else:
    print(" ❌ 전부 실패 → 클라우드 IP 차단. 제목·설명·챕터 기반 설계로 전환하거나")
    print("    자막 단계만 회사 PC에서 돌리는 방식을 검토합니다")
print("=" * 60)
