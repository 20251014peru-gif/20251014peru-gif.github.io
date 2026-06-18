"""
유튜브 요약 프로그램 - Flask 백엔드
실행: py app.py
접속: http://localhost:7070
"""

from flask import Flask, request, jsonify, send_from_directory
from youtube_transcript_api import YouTubeTranscriptApi
import anthropic
import re
import os
import urllib.request
import json

app = Flask(__name__, static_folder=".")

# ── Anthropic 클라이언트 ──────────────────────────────────────────
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

# ── 유틸 ────────────────────────────────────────────────────────
def extract_video_id(url: str) -> str:
    """유튜브 URL에서 video_id 추출"""
    patterns = [
        r"(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    raise ValueError("유효한 유튜브 URL이 아닙니다.")


def get_video_title(video_id: str) -> str:
    """유튜브 oEmbed API로 제목 가져오기 (API 키 불필요)"""
    try:
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        with urllib.request.urlopen(oembed_url, timeout=5) as resp:
            data = json.loads(resp.read())
            return data.get("title", "제목 없음")
    except Exception:
        return "제목 가져오기 실패"


def get_transcript(video_id: str) -> str:
    """자막 추출 (한국어 → 영어 순서로 시도)"""
    ytt = YouTubeTranscriptApi()
    try:
        snippets = ytt.fetch(video_id, languages=["ko"])
    except Exception:
        try:
            snippets = ytt.fetch(video_id, languages=["en"])
        except Exception:
            # 자동 생성 자막 포함 전체 시도
            snippets = ytt.fetch(video_id)

    return " ".join(s.text for s in snippets)


SYSTEM_PROMPT = """당신은 투자 콘텐츠 분석 전문가입니다.
유튜브 영상의 자막을 받아 아래 구조로 완전하고 자세하게 분석합니다.
수치, 종목명, 날짜 등 구체적 정보는 빠짐없이 포함하세요.
응답은 반드시 HTML 형식으로만 출력하세요 (다른 설명 없이).
"""

def build_user_prompt(title: str, transcript: str) -> str:
    return f"""영상 제목: {title}

자막 전문:
{transcript}

---

아래 HTML 구조로 분석 결과를 출력해주세요.
CSS 클래스는 그대로 사용하고, 내용만 채워주세요:

<div class="result-wrap">

  <div class="section title-section">
    <div class="section-label">📺 영상 제목</div>
    <div class="video-title">{title}</div>
  </div>

  <div class="section">
    <div class="section-label">📋 전체 내용 완전 요약</div>
    <div class="content-block">
      <!-- 수치·종목·날짜 빠짐없이, 발언 순서대로 상세히 -->
    </div>
  </div>

  <div class="section">
    <div class="section-label">📊 5열 분석표</div>
    <table class="analysis-table">
      <thead>
        <tr>
          <th>📡 신호</th>
          <th>🔄 변화</th>
          <th>💡 기회</th>
          <th>🧠 무의식 전달</th>
          <th>🎯 달님 액션</th>
        </tr>
      </thead>
      <tbody>
        <!-- 핵심 포인트마다 한 행씩, 최소 5행 -->
        <tr>
          <td>매크로 원인</td>
          <td>섹터·자금 흐름</td>
          <td>비정상→정상화 포인트</td>
          <td>두려움/확신/긴박감 메시지</td>
          <td>진입/대기/탈출 판단</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-label">🎬 6단 서사</div>
    <div class="narrative-grid">
      <div class="narrative-item"><span class="n-num">①</span><span class="n-label">훅</span><span class="n-text"><!-- 청중을 잡는 첫 메시지 --></span></div>
      <div class="narrative-item"><span class="n-num">②</span><span class="n-label">원인</span><span class="n-text"><!-- 현재 상황의 근본 원인 --></span></div>
      <div class="narrative-item"><span class="n-num">③</span><span class="n-label">정상화 예측</span><span class="n-text"><!-- 어떻게 회복/정상화될지 --></span></div>
      <div class="narrative-item"><span class="n-num">④</span><span class="n-label">진입 이유</span><span class="n-text"><!-- 왜 지금 들어가야 하는지 --></span></div>
      <div class="narrative-item"><span class="n-num">⑤</span><span class="n-label">탈출 기준</span><span class="n-text"><!-- 언제 나와야 하는지 --></span></div>
      <div class="narrative-item"><span class="n-num">⑥</span><span class="n-label">다음 복리</span><span class="n-text"><!-- 수익을 어디에 재투자할지 --></span></div>
    </div>
  </div>

</div>
"""


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/api/summarize", methods=["POST"])
def summarize():
    data = request.json or {}
    url = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "URL을 입력해주세요."}), 400

    try:
        video_id = extract_video_id(url)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    try:
        title = get_video_title(video_id)
    except Exception:
        title = "제목 없음"

    try:
        transcript = get_transcript(video_id)
    except Exception as e:
        return jsonify({"error": f"자막 추출 실패: {e}"}), 400

    if not transcript.strip():
        return jsonify({"error": "자막이 비어있습니다."}), 400

    # Claude Sonnet 4.6 호출
    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8000,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": build_user_prompt(title, transcript)}
            ],
        )
        html_result = response.content[0].text
    except Exception as e:
        return jsonify({"error": f"Claude API 오류: {e}"}), 500

    return jsonify({
        "title": title,
        "video_id": video_id,
        "html": html_result,
    })


if __name__ == "__main__":
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("⚠️  ANTHROPIC_API_KEY 환경변수가 없습니다.")
        print("   PowerShell: $env:ANTHROPIC_API_KEY='sk-ant-...'")
    print("🚀 서버 시작: http://localhost:7070")
    app.run(host="0.0.0.0", port=7070, debug=False, threaded=True)
