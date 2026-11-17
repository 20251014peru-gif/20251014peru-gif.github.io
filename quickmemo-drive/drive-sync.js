(()=>{
'use strict';
const C=window.QMSyncCore, state=document.getElementById('cloudState');
const API='https://www.googleapis.com/drive/v3/', UP='https://www.googleapis.com/upload/drive/v3/';
let token='',expiry=0,client,folder='',remoteFiles=[],timer,connected=false,rerun=false;
const say=s=>state.textContent=s;
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function request(path,opts={}){
 if(!token||Date.now()>=expiry)throw Error('Google Drive 연결 버튼으로 다시 로그인하세요');
 const r=await fetch(path.startsWith('https://')?path:API+path,{...opts,headers:{...opts.headers,Authorization:'Bearer '+token}});
 if(!r.ok){if(r.status===401){token='';connected=false}throw Error('Drive 요청 실패 ('+r.status+'): '+(await r.text()).slice(0,160))}return r;
}
async function list(){let out=[],page='';do{const q=new URLSearchParams({q:"trashed=false and appProperties has { key='qmDrive' and value='v1' }",fields:'nextPageToken,files(id,name,mimeType,appProperties)',pageSize:'1000'});if(page)q.set('pageToken',page);const r=await(await request('files?'+q)).json();out.push(...r.files);page=r.nextPageToken||''}while(page);return out}
async function create(meta,blob){
 const boundary='qm_'+crypto.randomUUID();const form=new Blob(['--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+boundary+'\r\nContent-Type: '+(blob.type||'application/octet-stream')+'\r\n\r\n',blob,'\r\n--'+boundary+'--'],{type:'multipart/related; boundary='+boundary});
 return (await request(UP+'files?uploadType=multipart&fields=id,name,appProperties',{method:'POST',headers:{'Content-Type':form.type},body:form})).json();
}
async function getFolder(){const f=remoteFiles.find(x=>x.appProperties?.kind==='folder');if(f)return f.id;
 return (await(await request('files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'순간메모',mimeType:'application/vnd.google-apps.folder',appProperties:{qmDrive:'v1',kind:'folder'}})})).json()).id;
}
async function uploadAsset(id){const item=await getOne('images',id);if(!item?.blob)throw Error('기기에 사진이 없습니다: '+id);
 const key=await hash(await item.blob.arrayBuffer());let f=remoteFiles.find(f=>f.appProperties?.asset===key);
 if(!f){f=await create({name:key,parents:[folder],appProperties:{qmDrive:'v1',kind:'asset',asset:key}},item.blob);remoteFiles.push(f)}return key;
}
async function prepareImages(r){for(const id of r.note.images){const key=r.assets[id],present=await getOne('images',id);if(present){if(await hash(await present.blob.arrayBuffer())!==key)throw Error('사진 ID 충돌: '+id);continue}
 const f=remoteFiles.find(f=>f.appProperties?.asset===key);if(!f)throw Error('클라우드 사진 누락: '+id);
 const blob=await(await request('files/'+encodeURIComponent(f.id)+'?alt=media')).blob();if(blob.size>20*1024*1024||!blob.type.startsWith('image/'))throw Error('잘못된 사진 파일');if(await hash(await blob.arrayBuffer())!==key)throw Error('사진 검증 실패');
 await enqueue(()=>put('images',{id,blob,type:blob.type,name:id}));}}
async function cacheRevisions(){let result=[];for(const f of remoteFiles.filter(f=>f.appProperties?.kind==='revision')){let r=await getOne('revisions',f.id);if(!r){r=await(await request('files/'+encodeURIComponent(f.id)+'?alt=media')).json();if(!C.valid(r))throw Error('잘못된 클라우드 메모');await enqueue(()=>put('revisions',{...r,id:f.id}))}result.push(r)}return result}
async function publish(n){const assets={};for(const id of n.images||[])assets[id]=await uploadAsset(id);
 const r={v:1,rid:crypto.randomUUID(),parents:n._sync?.parents||[],note:{...C.clean(n),updated:n.updated},assets};
 const f=await create({name:'note-'+r.rid+'.json',parents:[folder],mimeType:'application/json',appProperties:{qmDrive:'v1',kind:'revision'}},new Blob([JSON.stringify(r)],{type:'application/json'}));
 remoteFiles.push(f);await enqueue(()=>put('revisions',{...r,id:f.id}));
 await enqueue(async()=>{const current=await getOne('notes',n.id);if(!current)return;current._sync={parents:[r.rid],signature:C.signature(n)};await put('notes',current);const i=notes.findIndex(x=>x.id===n.id);if(i>=0)notes[i]=current;if(active?.id===n.id)active._sync=current._sync});return r;
}
async function apply(r,id,parents,conflict=false){
 if(active?.id===id){rerun=true;return}
 await prepareImages(r);
 await enqueue(async()=>{const existing=await getOne('notes',id);if(existing&&existing._sync?.signature!==C.signature(existing))return;
 if(conflict&&existing)return;
 const n={...r.note,id};if(conflict)n.body='[동시 수정 보존]\n'+n.body;n._sync={parents,signature:C.signature(n)};await put('notes',n);const i=notes.findIndex(x=>x.id===id);if(i>=0)notes[i]=n;else notes.push(n)});
}
async function cycle(){
 if(!connected)return;if(!navigator.onLine){say('오프라인 · 기기에 저장 중');return}
 if(!db)return;
 say('Drive 동기화 중…');rerun=false;
 await pendingWrites;
 remoteFiles=await list();folder=await getFolder();const revisions=await cacheRevisions();
 for(const n of await getAll('notes')){if(n._sync?.signature===C.signature(n))continue;revisions.push(await publish(structuredClone(n)))}
 for(const [id,rs] of C.groups(revisions)){const hs=C.heads(rs);if(!hs.length)throw Error('메모 이력 오류');const winner=hs[hs.length-1];
 await apply(winner,id,hs.map(r=>r.rid));for(const conflict of hs.slice(0,-1))await apply(conflict,'conflict-'+conflict.rid,[],true)}
 render();say(rerun?'기기 저장 완료 · 편집 중인 메모는 닫은 뒤 병합합니다':'✓ Drive 동기화 완료 · '+new Date().toLocaleTimeString('ko-KR'));
}
let busy=false;
async function sync(){if(busy){rerun=true;return}busy=true;try{await navigator.locks.request('quickmemo-drive-sync',cycle)}catch(e){say('⚠ '+e.message+' · 기기 기록은 유지됩니다')}finally{busy=false}}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,1800)}
async function loginResult(response){try{
 if(response.error)throw Error(response.error_description||response.error);token=response.access_token;expiry=Date.now()+Math.max(0,Number(response.expires_in)-60)*1000;
 const info=await(await request('about?fields=user(permissionId,emailAddress)')).json(),account=info.user?.permissionId;if(!account)throw Error('계정 확인 실패');
 const bound=localStorage.getItem('qm-drive-owner');if(bound&&bound!==account){token='';throw Error('이 브라우저는 다른 계정에 연결돼 있습니다. 계정 혼합을 방지하기 위해 연결을 중단했습니다.')}
 if(!bound){if((await getAll('notes')).length&&!confirm('이 기기의 메모를 '+info.user.emailAddress+'의 Drive에 연결할까요?')){token='';return}localStorage.setItem('qm-drive-owner',account)}
 connected=true;document.getElementById('cloudSync').hidden=false;document.getElementById('cloudLogout').hidden=false;say('연결됨: '+info.user.emailAddress);await sync();
 }catch(e){say('⚠ '+e.message)}}
document.getElementById('cloudLogin').onclick=()=>{if(!window.google?.accounts?.oauth2){say('Google 로그인 로딩 중입니다. 인터넷 연결을 확인하고 다시 눌러주세요.');return}if(!navigator.locks){say('최신 Chrome 또는 Safari에서 열어주세요.');return}
 client=google.accounts.oauth2.initTokenClient({client_id:window.QM_DRIVE.clientId,scope:'https://www.googleapis.com/auth/drive.file',callback:loginResult,error_callback:e=>say('로그인 창을 열지 못했습니다: '+e.type)});client.requestAccessToken({prompt:'select_account'})};
document.getElementById('cloudSync').onclick=sync;
document.getElementById('cloudLogout').onclick=()=>{if(busy){say('동기화가 끝난 뒤 연결을 해제하세요.');return}token='';connected=false;document.getElementById('cloudSync').hidden=true;document.getElementById('cloudLogout').hidden=true;say('연결 해제 · 기기 기록 유지 · 계정 보호를 위해 연결 계정은 유지됩니다')};
window.addEventListener('qm-local-save',schedule);window.addEventListener('online',schedule);window.addEventListener('offline',()=>say('오프라인 · 기기에 저장 중'));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});setInterval(()=>{if(!document.hidden)sync()},60000);
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>say('오프라인 화면 준비 실패 · 온라인에서 새로고침하세요'));
})();
