import {esc,icon} from '../ui.js';
import {dayKey} from '../core/model.js';
import {openTimeDial} from './time-dial.js';
import {getInvestmentReminder,activeInvestmentReminder,scheduleInvestmentReminder,cancelInvestmentReminder} from '../core/investment-snooze.js';

const format=at=>new Date(at).toLocaleString('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
export function mountRemindLater({host,button,store,record,onChange=()=>{},onBusy=()=>{},onSettings=()=>{}}){
 let reminder=null,busy=false,expanded=false,disposed=false,message='',generation=0;
 const initial=new Date(Math.ceil((Date.now()+3600000)/300000)*300000);
 let customTime=String(initial.getHours()).padStart(2,'0')+':'+String(initial.getMinutes()).padStart(2,'0');
 host.innerHTML='<section class="remind-later"><p class="remind-status" role="status"></p><div class="remind-options" id="remind-options" hidden><h3>언제 다시 알려드릴까요?</h3><div class="remind-presets">'+[1,3,6,24].map(h=>'<button type="button" class="soft" data-hours="'+h+'">'+h+'시간 후</button>').join('')+'</div><div class="remind-custom"><label class="field">직접 날짜 선택<input type="date" data-remind-date value="'+dayKey(initial)+'" min="'+dayKey()+'"></label><button type="button" class="time-trigger" data-remind-time aria-label="다시 알림 시간 선택">'+icon('clock')+'<span>'+customTime+'</span></button><button type="button" class="primary" data-remind-save>이 시간에 알림</button></div><p class="form-note">원래 기록 날짜는 유지됩니다. 다시 예약하면 이전 알림 시간이 바뀝니다.</p></div><div class="remind-bottom"><button type="button" class="soft" data-remind-cancel hidden>예약 취소</button><button type="button" class="soft" data-remind-settings>알림 설정</button></div><p class="form-note" data-remind-device></p><p class="form-error" role="alert" data-remind-error></p></section>';
 const status=host.querySelector('.remind-status'),panel=host.querySelector('.remind-options'),cancel=host.querySelector('[data-remind-cancel]'),error=host.querySelector('[data-remind-error]'),device=host.querySelector('[data-remind-device]');
 button.setAttribute('aria-controls','remind-options');
 function paint(){
  if(disposed)return;
  const active=activeInvestmentReminder(reminder);
  status.textContent=active?(+new Date(reminder.start)>Date.now()?'다시 알림 예약 · ':'마지막 다시 알림 시간 · ')+format(reminder.start)+(store.isCloud?'':' · 체험 저장'):message;
  cancel.hidden=!active;panel.hidden=!expanded;button.setAttribute('aria-expanded',String(expanded));
  button.disabled=busy;host.querySelectorAll('button,input').forEach(b=>b.disabled=busy);onBusy(busy);
 }
 async function run(work,success){
  if(busy)return;generation++;busy=true;message='';error.textContent='';paint();
  try{reminder=await work();expanded=false;await onChange();if(!disposed)message=success;}
  catch(e){if(!disposed)error.textContent=e.queued?'서버에 알림을 예약하지 못했습니다. 연결 후 다시 시도해 주세요.':e.message;}
  finally{busy=false;paint();}
 }
 const schedule=when=>run(()=>scheduleInvestmentReminder(store,record,when),'다시 알림을 예약했습니다.');
 button.onclick=()=>{expanded=!expanded;paint();if(expanded)panel.scrollIntoView({block:'nearest',behavior:'smooth'});};
 host.querySelectorAll('[data-hours]').forEach(b=>b.onclick=()=>schedule(new Date(Date.now()+Number(b.dataset.hours)*3600000)));
 host.querySelector('[data-remind-time]').onclick=e=>openTimeDial(customTime,'다시 알림 시간',value=>{customTime=value;host.querySelector('[data-remind-time] span').textContent=value;},e.currentTarget);
 host.querySelector('[data-remind-save]').onclick=()=>schedule(new Date(host.querySelector('[data-remind-date]').value+'T'+customTime));
 cancel.onclick=()=>run(()=>cancelInvestmentReminder(store,record),'다시 알림을 취소했습니다.');
 host.querySelector('[data-remind-settings]').onclick=onSettings;
 device.textContent=store.isCloud?'알림을 받을 기기의 연결 상태를 확인하는 중…':'체험 공간에서는 시간만 저장되며 실제 알림은 발송되지 않습니다.';
 if(store.isCloud)store.request('/subscriptions').then(r=>{if(disposed)return;device.textContent=r.devices?.length?'연결된 기기 '+r.devices.length+'개로 알림을 보냅니다. 휴대폰이 연결되어 있는지 알림 설정에서 확인하세요.':'연결된 알림 기기가 없습니다. 알림 설정에서 휴대폰을 연결해 주세요.';}).catch(()=>{if(!disposed)device.textContent='기기 연결 상태를 확인하지 못했습니다. 알림 설정에서 확인해 주세요.';});
 getInvestmentReminder(store,record).then(e=>{if(!generation&&!disposed){reminder=e;paint();}}).catch(e=>{if(!disposed)error.textContent=e.message;});
 paint();
 return {dispose(){disposed=true;},setBusy(value){busy=value;paint();}};
}
