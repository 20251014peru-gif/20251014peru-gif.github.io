(()=>{
'use strict';
const C=window.QMSyncCore, state=document.getElementById('cloudState');
const API='https://www.googleapis.com/drive/v3/', UP='https://www.googleapis.com/upload/drive/v3/';
let token='',expiry=0,client,folder='',remoteFiles=[],timer,connected=false,rerun=false;
let statusKind='checking',lastSuccess=Number(localStorage.getItem('qm-drive-last-success')||0),dirty=false,saveGeneration=0,retryCount=0,retryTimer,authEmail='',authPending=false,expiryTimer,authWaiters=[];
let automaticEnabled=localStorage.getItem('qm-drive-auto')!=='off',resumeJob=null,renewAfter=0;
const authChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('qm-drive-connection'):null;
function announce(){authChannel?.postMessage({type:'changed'})}

function finishAuth(ok){authPending=false;for(const w of authWaiters.splice(0)){clearTimeout(w.timer);w.resolve(ok)}}
const ui=document.createElement('aside');ui.id='driveIndicator';ui.setAttribute('aria-label','Drive 동기화 상태');ui.innerHTML='<span id="driveLive" role="status" aria-live="polite"></span><button type="button" id="driveAction">연결</button><div id="driveWarning" role="alert" hidden></div>';
ui.hidden=true;document.body.append(ui);
function show(kind,message){statusKind=kind;state.textContent=message;ui.dataset.kind=kind;document.getElementById('driveLive').textContent=message;document.getElementById('driveWarning').hidden=true;for(const id of ['syncHeart','editorSyncHeart']){const heart=document.getElementById(id);if(!heart)continue;heart.dataset.state=kind;heart.setAttribute('aria-label',message);heart.title=message+(lastSuccess?' · 마지막 완료 '+new Date(lastSuccess).toLocaleString('ko-KR'):'')}const action=document.getElementById('quickSync');if(action){action.disabled=kind==='syncing';action.setAttribute('aria-label',!connected?'Drive 재연결':'지금 동기화')}document.getElementById('driveAction').textContent=!connected?'Drive 재연결':'지금 동기화';}
async function cachedConnection(){try{const saved=await window.QMDriveSession?.load();if(saved?.token&&saved.expiry>Date.now()&&saved.account===localStorage.getItem('qm-drive-owner')){const changed=token!==saved.token||expiry!==saved.expiry;token=saved.token;expiry=saved.expiry;authEmail=saved.email||'';connected=true;if(changed)armExpiry();document.getElementById('cloudLogin').textContent='Drive 연결됨';document.getElementById('cloudSync').hidden=false;document.getElementById('cloudLogout').hidden=false;return true}}catch(e){}return false}
const say=s=>show(s.startsWith('⚠')?'error':statusKind,s);
function armExpiry(){clearTimeout(expiryTimer);expiryTimer=setTimeout(async()=>{if(await cachedConnection()){armExpiry();schedule()}else needAuth()},Math.max(0,expiry-Date.now())+50)}
function needAuth(){clearTimeout(expiryTimer);connected=false;token='';renewAfter=0;document.getElementById('cloudLogin').textContent='Drive 다시 연결';show('auth','Google 권한 갱신 필요 · Drive 재연결을 눌러주세요');}
function retry(){clearTimeout(retryTimer);if(connected&&navigator.onLine&&!document.hidden)retryTimer=setTimeout(sync,Math.min(60000,3000*2**Math.min(retryCount++,4)));}

const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function request(path,opts={},retried=false){
 if((!token||Date.now()>=expiry)&&!await cachedConnection()){needAuth();throw Error('Google 권한 갱신이 필요합니다')}
 const usedToken=token,abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),45000);let r;try{r=await fetch(path.startsWith('https://')?path:API+path,{...opts,signal:abort.signal,headers:{...opts.headers,Authorization:'Bearer '+token}})}finally{clearTimeout(timeout)}
 if(!r.ok){if(r.status===401){if(!retried&&await cachedConnection()&&token!==usedToken)return request(path,opts,true);needAuth();const cached=await window.QMDriveSession?.load();if(cached?.token===usedToken)await window.QMDriveSession?.clear();}throw Error('Drive 요청 실패 ('+r.status+'): '+(await r.text()).slice(0,160))}return r;
}
async function fullList(){let out=[],page='';do{const q=new URLSearchParams({q:"trashed=false and appProperties has { key='qmDrive' and value='v1' }",fields:'nextPageToken,files(id,name,mimeType,appProperties)',pageSize:'1000'});if(page)q.set('pageToken',page);const r=await(await request('files?'+q)).json();out.push(...r.files);page=r.nextPageToken||''}while(page);return out}
const INDEX='__qm_drive_index_v1';
async function list(){
 let checkpoint=await getOne('revisions',INDEX);
 if(!checkpoint?.cursor){const start=await(await request('changes/startPageToken?fields=startPageToken')).json();const files=await fullList();await enqueue(()=>put('revisions',{id:INDEX,cursor:start.startPageToken,files}));return files}
 const files=new Map(checkpoint.files.map(f=>[f.id,f]));let cursor=checkpoint.cursor;
 try{do{const q=new URLSearchParams({pageToken:cursor,pageSize:'1000',spaces:'drive',fields:'nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,appProperties,trashed))'});
 const page=await(await request('changes?'+q)).json();for(const c of page.changes||[]){if(c.removed||c.file?.trashed)files.delete(c.fileId);else if(c.file?.appProperties?.qmDrive==='v1')files.set(c.fileId,c.file);else files.delete(c.fileId)}
 if(page.nextPageToken){cursor=page.nextPageToken;continue}if(!page.newStartPageToken)throw Error('변경 확인 응답 오류');cursor=page.newStartPageToken;break}while(true)
 }catch(e){if(e.message.includes('(410)')){await enqueue(()=>put('revisions',{id:INDEX,cursor:null,files:[]}));return list()}throw e}
 const out=[...files.values()];await enqueue(()=>put('revisions',{id:INDEX,cursor,files:out}));return out;
}
async function pool(items,fn){let next=0;const out=new Array(items.length);await Promise.all(Array.from({length:Math.min(2,items.length)},async()=>{while(next<items.length){const i=next++;out[i]=await fn(items[i],i)}}));return out}
const assetJobs=new Map();
async function imageHash(item){if(item.sha256&&item.hashSize===item.blob.size&&item.hashType===item.blob.type)return item.sha256;const key=await hash(await item.blob.arrayBuffer());await enqueue(()=>put('images',{...item,sha256:key,hashSize:item.blob.size,hashType:item.blob.type}));return key}
async function create(meta,blob){
 const boundary='qm_'+crypto.randomUUID();const form=new Blob(['--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+boundary+'\r\nContent-Type: '+(blob.type||'application/octet-stream')+'\r\n\r\n',blob,'\r\n--'+boundary+'--'],{type:'multipart/related; boundary='+boundary});
 return (await request(UP+'files?uploadType=multipart&fields=id,name,appProperties',{method:'POST',headers:{'Content-Type':form.type},body:form})).json();
}
async function getFolder(){const f=remoteFiles.find(x=>x.appProperties?.kind==='folder');if(f)return f.id;
 return (await(await request('files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'순간메모',mimeType:'application/vnd.google-apps.folder',appProperties:{qmDrive:'v1',kind:'folder'}})})).json()).id;
}
async function uploadAsset(id){const item=await getOne('images',id);if(!item?.blob)throw Error('기기에 사진이 없습니다: '+id);
 const key=await imageHash(item);if(assetJobs.has(key))return assetJobs.get(key);
 const job=(async()=>{let f=remoteFiles.find(f=>f.appProperties?.asset===key);if(!f){say('사진을 Drive에 올리는 중…');f=await create({name:key,parents:[folder],appProperties:{qmDrive:'v1',kind:'asset',asset:key}},item.blob);remoteFiles.push(f)}return key})();assetJobs.set(key,job);try{return await job}finally{assetJobs.delete(key)};
}
async function prepareImages(r){await pool(r.note.images,async id=>{const key=r.assets[id],present=await getOne('images',id);if(present){if(await imageHash(present)!==key)throw Error('사진 ID 충돌: '+id);return}
 const f=remoteFiles.find(f=>f.appProperties?.asset===key);if(!f)throw Error('클라우드 사진 누락: '+id);
 say('사진을 기기에 받는 중…');const blob=await(await request('files/'+encodeURIComponent(f.id)+'?alt=media')).blob();const header=r.note.secure?.imageHeaders?.[id];if(blob.size>(header?21:20)*1024*1024||(!header&&!blob.type.startsWith('image/')))throw Error('잘못된 사진 파일');if(await hash(await blob.arrayBuffer())!==key)throw Error('사진 검증 실패');
 await enqueue(()=>put('images',{id,blob,type:blob.type,name:id,...(header?{sealedImage:header}:{}),sha256:key,hashSize:blob.size,hashType:blob.type}));})}
async function cacheRevisions(){const cache=new Map((await getAll('revisions')).map(r=>[r.id,r]));return pool(remoteFiles.filter(f=>f.appProperties?.kind==='revision'),async f=>{let r=cache.get(f.id);if(!r){r=await(await request('files/'+encodeURIComponent(f.id)+'?alt=media')).json();if(!C.valid(r))throw Error('잘못된 클라우드 메모');if(r.note.type!=='daily'||r.note.secure)await enqueue(()=>put('revisions',{...r,id:f.id}))}return {...r,_fileId:f.id}})}
async function publish(n){if(n.type==='daily'&&!n.secure)throw Error('기존 데이터 암호화 전환이 필요합니다.');const assets={};await pool(n.images||[],async id=>{assets[id]=await uploadAsset(id)});
 const r={v:1,rid:crypto.randomUUID(),parents:n._sync?.parents||[],note:{...C.clean(n),updated:n.updated},assets};
 const f=await create({name:'note-'+r.rid+'.json',parents:[folder],mimeType:'application/json',appProperties:{qmDrive:'v1',kind:'revision'}},new Blob([JSON.stringify(r)],{type:'application/json'}));
 remoteFiles.push(f);await enqueue(()=>put('revisions',{...r,id:f.id}));
 await enqueue(async()=>{const current=await getOne('notes',n.id);if(!current)return;current._sync={parents:[r.rid],signature:C.signature(n)};await put('notes',current);const i=notes.findIndex(x=>x.id===n.id);if(i>=0)notes[i]=current;if(active?.id===n.id)active._sync=current._sync});return r;
}
async function apply(r,id,parents){
 const prior=await getOne('notes',id);if(prior&&prior._sync?.signature===C.signature(prior)&&JSON.stringify(prior._sync.parents)===JSON.stringify(parents)){await prepareImages(r);return}
 if(active?.id===id){rerun=true;return}
 await prepareImages(r);
 await enqueue(async()=>{const existing=await getOne('notes',id);if(existing&&existing._sync?.signature!==C.signature(existing))return;
 const n={...r.note,id},archived=C.isConflictCopy(n)&&!n.deleted;if(archived){n.deleted=true;n.updated=new Date().toISOString();saveGeneration++;}n._sync={parents,signature:archived?'':C.signature(n)};await put('notes',n);const i=notes.findIndex(x=>x.id===id);if(i>=0)notes[i]=n;else notes.push(n)});
}
async function archiveConflictCopies(){let count=0;for(const n of await getAll('notes'))if(C.isConflictCopy(n)&&!n.deleted){const archived={...n,deleted:true,updated:new Date().toISOString()};await enqueue(()=>put('notes',archived));const i=notes.findIndex(x=>x.id===n.id);if(i>=0)notes[i]=archived;count++}return count}
window.addEventListener('qm-ready',async()=>{if(await archiveConflictCopies()){render();schedule()}});
async function cycle(){
 if(!connected)return;if(!navigator.onLine){show('offline','오프라인 · 동기화 대기');return}if(Date.now()>=expiry&&!await cachedConnection()){needAuth();return}
 if(!db)return;
 const generation=saveGeneration;show('syncing','↻ Drive 동기화 중…');rerun=false;
 await pendingWrites;await archiveConflictCopies();
 remoteFiles=await list();folder=await getFolder();const beforeLocal=await getAll('notes');const revisions=await cacheRevisions();let legacyPending=false,legacyHistory=false;
 for(const n of (await getAll('notes')).sort((a,b)=>(a.images?.length||0)-(b.images?.length||0))){if(n.type==='daily'&&!n.secure){legacyPending=true;continue}if(n._sync?.signature===C.signature(n))continue;revisions.push(await publish(structuredClone(n)))}
 for(const [id,rs] of C.groups(revisions)){const privateGroup=rs.some(r=>r.note.secure);if(privateGroup&&rs.some(r=>r.note.type==='daily'&&!r.note.secure))legacyHistory=true;const usable=privateGroup?rs.filter(r=>r.note.secure):rs;const hs=C.heads(usable);if(!hs.length)throw Error('메모 이력 오류');const winner=hs[hs.length-1];if(winner.note.type==='daily'&&!winner.note.secure){legacyPending=true;continue}
 await apply(winner,id,hs.map(r=>r.rid))}
 const sealedIds=(await getAll('notes')).filter(n=>n.secure).map(n=>n.id);if(sealedIds.length&&window.QMVault){const oldIds=beforeLocal.filter(n=>!n.secure&&sealedIds.includes(n.id)).flatMap(n=>n.images||[]);for(const r of await getAll('revisions'))if(r.note&&!r.note.secure&&sealedIds.includes(r.note.id))oldIds.push(...r.note.images);await QMVault.cleanupLocal(sealedIds,oldIds)}const vaultStatus=document.getElementById('vaultStatus');if(vaultStatus&&!window.QMVault?.migrating)vaultStatus.textContent=legacyPending?'아직 전환하지 않은 데이터 기록이 있습니다. 암호화 전환 후 동기화할 수 있습니다.':legacyHistory?'암호화 이전의 평문 이력이 남아 있습니다. 기존 자료 전환에서 검증 후 정리할 수 있습니다.':'데이터 내용·사진은 암호화합니다. 비밀번호 분실 시 복구할 수 없습니다.';render();lastSuccess=Date.now();localStorage.setItem('qm-drive-last-success',String(lastSuccess));dirty=saveGeneration!==generation;retryCount=0;show(dirty||rerun||legacyPending?'pending':'ready',dirty?'새 변경사항을 이어서 동기화합니다…':legacyPending?'일반 메모 동기화 완료 · 일부 기록 대기':rerun?'기기 저장 완료 · 편집 중인 메모는 닫은 뒤 병합합니다':'✓ Drive 동기화 완료 · '+new Date().toLocaleTimeString('ko-KR'));
}
let busy=false;
async function sync(){if(!automaticEnabled)return;if(busy){rerun=true;return}if(!connected&&!await cachedConnection()){if(localStorage.getItem('qm-drive-owner')&&statusKind!=='disconnected')show('auth','Drive 재연결 필요 · 새 기록은 동기화 대기 중');return}busy=true;clearTimeout(retryTimer);try{await navigator.locks.request('quickmemo-drive-sync',cycle)}catch(e){if(statusKind!=='auth'){show(navigator.onLine?'error':'offline','⚠ '+(e.name==='AbortError'?'응답 시간 초과':e.message));retry()}}finally{busy=false;if((dirty||rerun)&&connected&&statusKind!=='error'&&statusKind!=='offline')schedule()}}
async function secureMigrate(convert){if(!connected||!token)throw Error('먼저 Drive에 연결하세요.');if(busy)throw Error('현재 동기화가 끝난 뒤 다시 눌러주세요.');busy=true;try{return await navigator.locks.request('quickmemo-drive-sync',async()=>{await pendingWrites;remoteFiles=await list();folder=await getFolder();const rs=await cacheRevisions(),locals=await getAll('notes'),localMap=new Map(locals.map(n=>[n.id,n])),groups=C.groups(rs);const targetIds=new Set(locals.filter(n=>n.type==='daily').map(n=>n.id));for(const[id,versions]of groups)if(C.heads(versions).some(r=>r.note.type==='daily'))targetIds.add(id);const oldImages=new Set(),oldAssets=new Set();const legacyFiles=rs.filter(r=>targetIds.has(r.note.id)&&!r.note.secure);for(const r of legacyFiles){for(const id of r.note.images)oldImages.add(id);for(const key of Object.values(r.assets))oldAssets.add(key)}const loader=async(id,revision)=>{const present=await getOne('images',id),asset=revision?.assets?.[id];if(present&&(!asset||await imageHash(present)===asset))return present;const key=asset||rs.find(r=>r.assets?.[id])?.assets[id],file=remoteFiles.find(f=>f.appProperties?.asset===key);if(!file)throw Error('기존 사진을 찾을 수 없습니다: '+id);const blob=await(await request('files/'+encodeURIComponent(file.id)+'?alt=media')).blob();if(!blob.type.startsWith('image/')||blob.size>20*1024*1024||await hash(await blob.arrayBuffer())!==key)throw Error('기존 사진 검증 실패');return{id,blob,type:blob.type,name:id}};let converted=0;for(const id of targetIds){const versions=groups.get(id)||[],heads=C.heads(versions),local=localMap.get(id),candidates=[];if(local&&!local.secure&&local.type==='daily')candidates.push({note:local,revision:null});for(const r of heads)if(!r.note.secure&&r.note.type==='daily'&&!candidates.some(c=>C.signature(c.note)===C.signature(r.note)))candidates.push({note:r.note,revision:r});for(let i=0;i<candidates.length;i++){const candidate=candidates[i];const usePrimary=!local?.secure&&i===0;const n={...candidate.note,id:usePrimary?id:'secure-copy-'+(candidate.revision?.rid||crypto.randomUUID())};for(const image of n.images||[])oldImages.add(image);n._sync={parents:usePrimary?heads.map(r=>r.rid):[],signature:''};say('기존 데이터 암호화 중… '+(++converted)+'건');await convert(n,image=>loader(image,candidate.revision))}}
const sealed=(await getAll('notes')).filter(n=>n.type==='daily'&&n.secure);const currentRevisions=[];for(const n of sealed){const r=await publish(n);const file=remoteFiles.find(f=>f.name==='note-'+r.rid+'.json');if(!file)throw Error('암호화 업로드 확인 실패');const stored=await(await request('files/'+encodeURIComponent(file.id)+'?alt=media')).json();if(!C.valid(stored)||C.signature(stored.note)!==C.signature(n))throw Error('암호화 메모 재검증 실패');for(const asset of Object.values(r.assets)){const f=remoteFiles.find(f=>f.appProperties?.asset===asset);if(!f||await hash(await(await request('files/'+encodeURIComponent(f.id)+'?alt=media')).arrayBuffer())!==asset)throw Error('암호화 사진 재검증 실패')}currentRevisions.push(r)}
const retained=rs.filter(r=>!targetIds.has(r.note.id)||r.note.secure).concat(currentRevisions);const retainedAssets=new Set(retained.flatMap(r=>Object.values(r.assets)));const assetFiles=remoteFiles.filter(f=>f.appProperties?.kind==='asset'&&oldAssets.has(f.appProperties.asset)&&!retainedAssets.has(f.appProperties.asset));const deletions=[...legacyFiles.map(r=>r._fileId).filter(Boolean),...assetFiles.map(f=>f.id)];if(deletions.length&&!confirm('암호화 파일과 사진의 재검증을 완료했습니다. 기존 평문 메모 이력 '+legacyFiles.length+'개와 전용 원본 사진 '+assetFiles.length+'개를 Drive에서 영구 삭제합니다. 암호화 비밀번호를 잊으면 복구할 수 없습니다. 계속할까요?'))throw Error('기존 평문 삭제를 취소했습니다. 암호화 전환은 아직 완료되지 않았습니다.');for(const id of new Set(deletions)){say('기존 평문 파일 정리 중…');await request('files/'+encodeURIComponent(id),{method:'DELETE'})}await QMVault.cleanupLocal([...targetIds],[...oldImages]);await enqueue(()=>put('revisions',{id:INDEX,cursor:null,files:[]}));notes=await getAll('notes');render();const shared=[...oldAssets].filter(key=>retainedAssets.has(key)).length;return '암호화 전환 완료 · 데이터 '+sealed.length+'건 · 복구 기능 없음'+(shared?' · 일반 기록과 공유된 원본 사진 '+shared+'개는 일반 기록용으로 유지됩니다.':'');})}finally{busy=false}}
function ensureForSave(){if(connected&&token&&Date.now()<expiry)return Promise.resolve(true);if(!navigator.onLine)return Promise.resolve(false);return new Promise(resolve=>{const waiter={resolve,timer:setTimeout(()=>{const at=authWaiters.indexOf(waiter);if(at>=0)authWaiters.splice(at,1);resolve(false)},90000)};authWaiters.push(waiter);try{connect()}catch(e){finishAuth(false)}if(!authPending)finishAuth(false)})}
async function flush(noteId){clearTimeout(timer);const deadline=Date.now()+120000;while(busy&&Date.now()<deadline){const current=await getOne('notes',noteId);if(current&&current._sync?.signature===C.signature(current))return true;await new Promise(resolve=>setTimeout(resolve,80))}if(busy||!connected||!navigator.onLine)return false;await sync();const current=await getOne('notes',noteId);return !!(current&&current._sync?.signature===C.signature(current))}
window.QMDrive={get connected(){return connected&&!!token&&Date.now()<expiry},secureMigrate,ensureForSave,flush};
function schedule(){clearTimeout(timer);timer=setTimeout(sync,1800)}
async function loginResult(response){try{
 if(response.error)throw Error(response.error_description||response.error);if(!response.access_token)throw Error('Google 연결 응답이 없습니다');token=response.access_token;expiry=Date.now()+Math.max(0,Number(response.expires_in)-60)*1000;armExpiry();
 const info=await(await request('about?fields=user(permissionId,emailAddress)')).json(),account=info.user?.permissionId;if(!account)throw Error('계정 확인 실패');
 const bound=localStorage.getItem('qm-drive-owner');if(bound&&bound!==account){token='';throw Error('이 브라우저는 다른 계정에 연결돼 있습니다. 계정 혼합을 방지하기 위해 연결을 중단했습니다.')}
 if(!bound){if((await getAll('notes')).length&&!confirm('이 기기의 메모를 '+info.user.emailAddress+'의 Drive에 연결할까요?')){token='';show('disconnected','연결 취소 · 기기 기록 유지');finishAuth(false);return}localStorage.setItem('qm-drive-owner',account)}
 try{await window.QMDriveSession?.save({token,expiry,account,email:info.user.emailAddress})}catch(e){say('연결 정보 저장 불가 · 현재 창에서는 연결됩니다')}
 authEmail=info.user.emailAddress;connected=true;announce();document.getElementById('cloudLogin').textContent='Drive 연결됨';document.getElementById('cloudSync').hidden=false;document.getElementById('cloudLogout').hidden=false;say('연결됨: '+info.user.emailAddress);finishAuth(true);await sync();
 }catch(e){authPending=false;connected=false;token='';show('auth','⚠ '+e.message);finishAuth(false)}}
function connect(){automaticEnabled=true;localStorage.setItem('qm-drive-auto','on');if(authPending)return;if(!window.google?.accounts?.oauth2){say('Google 로그인 로딩 중입니다. 인터넷 연결을 확인하고 다시 눌러주세요.');return}if(!navigator.locks){say('최신 Chrome 또는 Safari에서 열어주세요.');return}
 client=google.accounts.oauth2.initTokenClient({client_id:window.QM_DRIVE.clientId,scope:'https://www.googleapis.com/auth/drive.file',callback:loginResult,error_callback:e=>{authPending=false;show('auth','Google 연결 취소 또는 창 차단 · 재연결을 눌러주세요');finishAuth(false)}});authPending=true;show('checking','Google 연결 확인 중…');try{client.requestAccessToken({prompt:localStorage.getItem('qm-drive-owner')?'':'select_account',...(authEmail?{hint:authEmail}:{})})}catch(e){authPending=false;show('auth','Google 연결을 다시 눌러주세요');finishAuth(false)}}
document.getElementById('quickSync').onclick=()=>{if(!connected||Date.now()>=expiry)connect();else sync()};document.getElementById('syncHeart').onclick=()=>document.getElementById('settingsDialog').showModal();document.getElementById('cloudLogin').onclick=connect;document.getElementById('driveAction').onclick=()=>{if(!connected||Date.now()>=expiry)connect();else sync()};
document.getElementById('cloudSync').onclick=sync;
document.getElementById('cloudLogout').onclick=async()=>{if(busy){say('동기화가 끝난 뒤 연결을 해제하세요.');return}automaticEnabled=false;localStorage.setItem('qm-drive-auto','off');await window.QMDriveSession?.clear();token='';connected=false;announce();document.getElementById('cloudLogin').textContent='Google Drive 연결';document.getElementById('cloudSync').hidden=true;document.getElementById('cloudLogout').hidden=true;clearTimeout(retryTimer);clearTimeout(expiryTimer);show('disconnected','Drive 연결 해제 · 자동 동기화 꺼짐')};
async function resume(){
 if(!automaticEnabled||document.hidden||!navigator.onLine)return;
 if(resumeJob)return resumeJob;
 resumeJob=(async()=>{if(typeof db==='undefined'||!db)return;await pendingWrites;if(!connected||Date.now()>=expiry){if(!await cachedConnection()){if(localStorage.getItem('qm-drive-owner'))needAuth();return}}await sync()})();
 try{await resumeJob}catch(e){show('error','⚠ 연결 확인 실패 · 자동 재시도 중');retry()}finally{resumeJob=null}
}
window.addEventListener('qm-local-save',()=>{dirty=true;saveGeneration++;show(!connected?'auth':navigator.onLine?'pending':'offline',!connected?'Drive 미연결 · 동기화 대기':'기기 저장 완료 · Drive 동기화 대기');schedule()});
window.addEventListener('online',()=>{retryCount=0;resume()});window.addEventListener('offline',()=>show('offline','오프라인 · 동기화 대기'));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume()});window.addEventListener('pageshow',resume);window.addEventListener('focus',resume);
authChannel?.addEventListener('message',async()=>{automaticEnabled=localStorage.getItem('qm-drive-auto')!=='off';if(!automaticEnabled){connected=false;token='';clearTimeout(expiryTimer);show('disconnected','Drive 연결 해제 · 자동 동기화 꺼짐');return}await resume()});
// Google requires a user gesture for an expired grant. Renew once on the first touch/key.
function renewOnGesture(e){if(!e.isTrusted||!automaticEnabled||!navigator.onLine||document.hidden||!localStorage.getItem('qm-drive-owner')||authPending||busy||Date.now()<renewAfter)return;if(connected&&Date.now()<expiry)return;if(e.target.closest?.('#quickSync,#cloudLogin,#cloudLogout,#finishBtn,#closeModal,#driveAction'))return;renewAfter=Date.now()+60000;connect()}
document.addEventListener('pointerup',renewOnGesture);document.addEventListener('keydown',e=>{if(e.key==='Enter')renewOnGesture(e)});
setInterval(()=>{if(!document.hidden)resume()},30000);
async function restoreSession(){if(!automaticEnabled){show('disconnected','Drive 연결 해제 · 자동 동기화 꺼짐');return}try{const saved=await window.QMDriveSession?.load();if(!saved){show(localStorage.getItem('qm-drive-owner')?'auth':'disconnected','Drive 미연결 · 연결 버튼을 눌러주세요');return}if(saved.account!==localStorage.getItem('qm-drive-owner')){show('auth','저장된 연결 계정을 확인해 주세요');return}authEmail=saved.email||'';if(saved.expiry<=Date.now()){needAuth();return}token=saved.token;expiry=saved.expiry;connected=true;armExpiry();document.getElementById('cloudLogin').textContent='Drive 연결됨';document.getElementById('cloudSync').hidden=false;document.getElementById('cloudLogout').hidden=false;show('pending','Drive 연결 복원됨 · 동기화 확인 중');await sync()}catch(e){show('auth','연결 복원 실패 · Drive 재연결을 눌러주세요')}}
show('checking','Drive 연결 확인 중');if(window.QMAppReady)restoreSession();else window.addEventListener('qm-ready',restoreSession,{once:true});
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>say('오프라인 화면 준비 실패 · 온라인에서 새로고침하세요'));
})();





