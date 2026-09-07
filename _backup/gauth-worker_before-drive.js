/* ══════════════════════════════════════════════════════════
   구글 무한 로그인 — Cloudflare Worker 추가 코드
   기존 hwan 워커의 fetch() 맨 앞에 아래 3줄을 넣고,
   파일 아래쪽에 handleGauth 함수를 통째로 붙여넣으면 됩니다.

     const u = new URL(request.url);
     if (u.pathname.startsWith('/gauth')) return handleGauth(request, env, u);

   ── 준비물 ────────────────────────────────────────────────
   1) Cloudflare 대시보드 → Workers → hwan → Settings → Variables
      · GOOGLE_CLIENT_ID     = (아래 2번에서 만든 웹 클라이언트 ID)
      · GOOGLE_CLIENT_SECRET = (같은 클라이언트의 보안 비밀)   ← Secret 로 저장
   2) KV 네임스페이스 하나 만들어 이름 GAUTH 로 바인딩
      Settings → Variables → KV Namespace Bindings → 변수명: GAUTH
   3) Google Cloud Console → 사용자 인증 정보
      · 애플리케이션 유형: **웹 애플리케이션**
      · 승인된 리디렉션 URI 에 아래 주소 추가
        https://hwan.20251014peru.workers.dev/gauth/cb
   ══════════════════════════════════════════════════════════ */

const GAUTH_SCOPE = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
].join(' ');

function gaCors(body, status, type) {
  return new Response(body, {
    status: status || 200,
    headers: {
      'content-type': type || 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store'
    }
  });
}

async function handleGauth(request, env, u) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': '*'
      }
    });
  }

  const REDIRECT = u.origin + '/gauth/cb';
  const CID = env.GOOGLE_CLIENT_ID;
  const CSEC = env.GOOGLE_CLIENT_SECRET;

  if (!CID || !CSEC) {
    return gaCors(JSON.stringify({ error: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 미설정' }), 500);
  }
  if (!env.GAUTH) {
    return gaCors(JSON.stringify({ error: 'KV 바인딩 GAUTH 없음' }), 500);
  }

  /* ── ① 동의 화면으로 보내기 ── */
  if (u.pathname === '/gauth/start') {
    const k = (u.searchParams.get('k') || '').trim();
    if (!k) return gaCors(JSON.stringify({ error: '열쇠 이름(k) 없음' }), 400);

    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.searchParams.set('client_id', CID);
    auth.searchParams.set('redirect_uri', REDIRECT);
    auth.searchParams.set('response_type', 'code');
    auth.searchParams.set('scope', GAUTH_SCOPE);
    auth.searchParams.set('access_type', 'offline');   // ← 재발급 열쇠 받기
    auth.searchParams.set('prompt', 'consent');        // ← 매번 새 refresh_token
    auth.searchParams.set('include_granted_scopes', 'true');
    auth.searchParams.set('state', k);
    return Response.redirect(auth.toString(), 302);
  }

  /* ── ② 구글이 돌려준 코드 → 재발급 열쇠 저장 ── */
  if (u.pathname === '/gauth/cb') {
    const code = u.searchParams.get('code');
    const k = (u.searchParams.get('state') || '').trim();
    const err = u.searchParams.get('error');

    const page = (msg, ok) =>
      gaCors(
        '<!doctype html><meta charset="utf-8">' +
        '<body style="font-family:system-ui,sans-serif;padding:40px;text-align:center">' +
        '<div style="font-size:44px">' + (ok ? '✅' : '⚠️') + '</div>' +
        '<h2 style="color:' + (ok ? '#1a7a4a' : '#a13030') + '">' + msg + '</h2>' +
        '<p style="color:#7a92a8">이 창은 닫으셔도 됩니다.</p>' +
        '<script>setTimeout(function(){try{window.close()}catch(e){}},2500)<\/script>' +
        '</body>',
        ok ? 200 : 400,
        'text/html; charset=utf-8'
      );

    if (err) return page('구글이 거절했어요: ' + err, false);
    if (!code || !k) return page('코드나 열쇠 이름이 없어요', false);

    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code,
        client_id: CID,
        client_secret: CSEC,
        redirect_uri: REDIRECT,
        grant_type: 'authorization_code'
      })
    });
    const d = await r.json().catch(() => null);
    if (!d || !d.refresh_token) {
      return page('재발급 열쇠를 못 받았어요' + (d && d.error ? (' (' + d.error + ')') : ''), false);
    }

    await env.GAUTH.put('rt:' + k, d.refresh_token);
    return page('연결됐습니다 — 이제 다시 로그인 안 해도 됩니다', true);
  }

  /* ── ③ 앱이 부를 때마다 새 access_token 발급 ── */
  if (u.pathname === '/gauth/token') {
    const k = (u.searchParams.get('k') || '').trim();
    if (!k) return gaCors(JSON.stringify({ error: '열쇠 이름(k) 없음' }), 400);

    const rt = await env.GAUTH.get('rt:' + k);
    if (!rt) return gaCors(JSON.stringify({ error: '아직 연결 안 됨 — /gauth/start 먼저' }), 404);

    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CID,
        client_secret: CSEC,
        refresh_token: rt,
        grant_type: 'refresh_token'
      })
    });
    const d = await r.json().catch(() => null);
    if (!d || !d.access_token) {
      /* 열쇠가 폐기된 경우 — 지우고 다시 연결하라고 알림 */
      if (d && (d.error === 'invalid_grant' || d.error === 'unauthorized_client')) {
        await env.GAUTH.delete('rt:' + k);
      }
      return gaCors(JSON.stringify({ error: (d && d.error) || '토큰 발급 실패' }), 400);
    }
    return gaCors(JSON.stringify({
      access_token: d.access_token,
      expires_in: d.expires_in || 3600
    }));
  }

  /* ── ④ 연결 해제 ── */
  if (u.pathname === '/gauth/off') {
    const k = (u.searchParams.get('k') || '').trim();
    if (k) await env.GAUTH.delete('rt:' + k);
    return gaCors(JSON.stringify({ ok: true }));
  }

  return gaCors(JSON.stringify({ error: 'unknown /gauth path' }), 404);
}
