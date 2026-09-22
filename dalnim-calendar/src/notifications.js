import {esc,icon,toast} from './ui.js';
const stateText={preparing:'발송 준비',accepted:'푸시 서비스 접수',partial:'일부 기기 접수',failed:'발송 실패','no-device':'수신 기기 없음'};
export async function mountNotifications(host,store,connect){
 const canPush='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 const permission=canPush?Notification.permission:'unsupported';
 host.innerHTML='<section class="push-panel"><div class="push-heading"><div><span class="eyebrow">STAY CONNECTED</span><h3>내 기기의 알림</h3></div><span class="pill">'+(store.isCloud?'클라우드 연결':'서버 연결 전')+'</span></div><div class="push-checks"><div><span>서버 연결</span><strong>'+ (store.isCloud?'연결됨':'연결 필요')+'</strong></div><div><span>브라우저 지원</span><strong>'+(canPush?'지원됨':'홈 화면 앱 확인')+'</strong></div><div><span>알림 권한</span><strong>'+({granted:'허용됨',denied:'차단됨',default:'허용 필요',unsupported:'지원 확인 필요'})[permission]+'</strong></div></div><p class="form-note">푸시 서비스 접수와 실제 알림 열기를 구분해 보여드려요. 휴대폰의 알림·방해금지·배터리 설정에 따라 표시가 지연될 수 있습니다.</p><div class="row-actions"><button class="soft" data-push-connect>'+icon('link')+(store.isCloud?'이 기기 연결':'클라우드 연결')+'</button><button class="primary" data-push-test '+(!store.isCloud?'disabled':'')+'>'+icon('bell')+'테스트 알림 보내기</button><button data-push-refresh '+(!store.isCloud?'disabled':'')+'>새로고침</button></div><p class="form-error" role="alert" data-push-error></p><div data-push-devices></div><div data-push-history></div></section>';
 const fail=e=>{if(host.isConnected)host.querySelector('[data-push-error]').textContent=e.message;};
 host.querySelector('[data-push-connect]').onclick=async()=>{try{await connect();if(store.isCloud)await refresh();}catch(e){fail(e);}};
 host.querySelector('[data-push-test]').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{const result=await store.request('/notifications/test','POST',{requestId:crypto.randomUUID()});toast(stateText[result.state]||'요청을 처리했습니다.');await refresh();}catch(e){fail(e);}finally{b.disabled=false;}};
 host.querySelector('[data-push-refresh]').onclick=()=>refresh().catch(fail);
 async function refresh(){
  if(!store.isCloud)return;
  const [a,b]=await Promise.all([store.request('/subscriptions'),store.request('/notifications')]);if(!host.isConnected)return;
  host.querySelector('[data-push-devices]').innerHTML='<div class="side-heading" style="margin-top:24px"><span>등록된 기기 · '+a.devices.length+'개</span></div>'+a.devices.map(d=>'<div class="push-device"><span>'+icon('bell')+esc(d.name)+'</span><button data-remove-device="'+esc(d.id)+'">연결 해제</button></div>').join('');
  host.querySelectorAll('[data-remove-device]').forEach(btn=>btn.onclick=async()=>{try{await store.request('/subscriptions/remove','POST',{id:btn.dataset.removeDevice});await refresh();toast('이 기기의 서버 알림 등록을 해제했습니다.');}catch(e){fail(e);}});
  host.querySelector('[data-push-history]').innerHTML='<div class="side-heading" style="margin-top:24px"><span>최근 발송 상태</span><span>최대 50건</span></div>'+b.notifications.map(n=>'<div class="push-history"><div><strong>'+esc(n.title||'일정 알림')+'</strong><small>'+new Date(n.createdAt).toLocaleString('ko-KR')+'</small></div><span class="pill '+(n.openedAt?'confirmed':'')+'">'+(n.openedAt?'알림 열기 확인':esc(stateText[n.state]||n.state))+'</span></div>').join('')+(!b.notifications.length?'<p class="form-note">아직 실제 발송 내역이 없습니다.</p>':'');
 }
 await refresh().catch(fail);
}
export async function confirmNotificationOpen(store){
 const params=new URLSearchParams(location.search),id=params.get('delivery');if(!id||!store.isCloud)return;
 await store.request('/notifications/opened','POST',{id});params.delete('delivery');history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);
}
