(()=>{'use strict';
const KEY='qm-drive-redirect-v1',LIFETIME=10*60*1000;let result=null;
function same(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
const params=new URLSearchParams(location.hash.slice(1));
if(params.has('access_token')||params.has('error')){
 // Fragments never reach the server. Remove the response before loading any other scripts.
 history.replaceState(null,'',location.pathname+location.search);
 try{const saved=JSON.parse(sessionStorage.getItem(KEY)||'null');sessionStorage.removeItem(KEY);if(!saved||!same(saved.state,params.get('state'))||saved.origin!==location.origin||Date.now()-saved.created>LIFETIME||saved.created>Date.now())throw Error('연결 요청 확인에 실패했습니다. 현재 창에서 연결을 다시 누르세요.');
 if(params.has('error'))throw Error('Google 연결이 완료되지 않았습니다: '+params.get('error').slice(0,80));
 const seconds=Number(params.get('expires_in')),scopes=(params.get('scope')||'').split(' ');if(!params.get('access_token')||!Number.isFinite(seconds)||seconds<=60||seconds>86400||!scopes.includes('https://www.googleapis.com/auth/drive.file'))throw Error('Google Drive 연결 응답을 확인할 수 없습니다.');
 result={access_token:params.get('access_token'),expires_in:seconds};
 }catch(e){result={error:'redirect_validation',error_description:e.message}}
}
window.QMRedirectAuth={take(){const value=result;result=null;return value},begin(clientId){if(!clientId)throw Error('Google 연결 설정이 없습니다.');const state=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');sessionStorage.setItem(KEY,JSON.stringify({state,created:Date.now(),origin:location.origin}));const redirect=new URL('./',location.href).href;const q=new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'token',scope:'https://www.googleapis.com/auth/drive.file',include_granted_scopes:'true',prompt:'select_account',state});location.assign('https://accounts.google.com/o/oauth2/v2/auth?'+q)}};
})();
