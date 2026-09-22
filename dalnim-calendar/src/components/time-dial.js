import {esc,icon} from '../ui.js';
const pad=n=>String(n).padStart(2,'0');
export function dateTimeField(name,label,value,allDay){
 return `<div class="field"><span id="${name}-label">${label}</span><input type="hidden" name="${name}" value="${esc(value)}"><div class="date-time-control"><input type="date" data-date="${name}" aria-labelledby="${name}-label" required value="${value.slice(0,10)}"><button type="button" class="time-trigger" data-time="${name}" aria-label="${label} 시간 선택" ${allDay?'hidden':''}>${icon('clock')}<span>${value.slice(11)||'09:00'}</span></button></div></div>`;
}
export function bindDateTimes(form){
 const times={start:form.start.value.slice(11)||'09:00',end:form.end.value.slice(11)||'10:00'};
 const sync=name=>{form[name].value=form.querySelector(`[data-date="${name}"]`).value+(form.allDay.checked?'':'T'+times[name]);};
 for(const name of ['start','end']){
  const trigger=form.querySelector(`[data-time="${name}"]`);
  form.querySelector(`[data-date="${name}"]`).onchange=()=>sync(name);
  trigger.onclick=()=>openTimeDial(times[name],name==='start'?'시작 시간':'종료 시간',value=>{times[name]=value;trigger.querySelector('span').textContent=value;sync(name);},trigger);
 }
 form.allDay.addEventListener('change',()=>{for(const name of ['start','end']){form.querySelector(`[data-time="${name}"]`).hidden=form.allDay.checked;sync(name);}form.querySelector('#end-label').textContent=form.allDay.checked?'마지막 날짜':'종료';});
}
export function openTimeDial(value,label,onSelect,trigger){
 let [hour,minute]=value.split(':').map(Number),part='hour';
 const dialog=document.createElement('dialog');dialog.className='time-dial-dialog';dialog.setAttribute('aria-labelledby','dial-title');
 dialog.innerHTML=`<div class="dialog-head"><div><p class="eyebrow">A MOMENT IN YOUR DAY</p><h2 id="dial-title">${label}</h2></div><button type="button" data-cancel aria-label="시간 선택 닫기">${icon('close')}</button></div><div class="dial-body"><div class="dial-readout"><button type="button" data-part="hour" aria-label="시 선택"></button><span>:</span><button type="button" data-part="minute" aria-label="분 선택"></button><div class="dial-period"><button type="button" data-period="am">오전</button><button type="button" data-period="pm">오후</button></div></div><p class="dial-hint">시를 고른 다음, 분을 5분 단위로 골라 주세요.</p><div class="clock-face" aria-label="시 선택 다이얼"><div class="clock-hand"></div><i class="clock-center"></i><div class="clock-numbers"></div></div><p class="dial-value" aria-live="polite"></p></div><div class="dialog-actions"><button type="button" class="soft" data-cancel>취소</button><button type="button" class="primary" data-apply>시간 적용</button></div>`;
 document.body.append(dialog);
 const paint=()=>{
  dialog.querySelector('[data-part=hour]').textContent=pad(hour%12||12);
  dialog.querySelector('[data-part=minute]').textContent=pad(minute);
  dialog.querySelectorAll('[data-part]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.part===part));
  dialog.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',(b.dataset.period==='pm')===(hour>=12)));
  dialog.querySelector('.clock-face').setAttribute('aria-label',part==='hour'?'시 선택 다이얼':'분 선택 다이얼 · 5분 간격');
  dialog.querySelector('.clock-hand').style.transform=`rotate(${part==='hour'?(hour%12)*30:minute*6}deg)`;
  dialog.querySelector('.clock-numbers').innerHTML=Array.from({length:12},(_,i)=>{
   const n=part==='hour'?(i||12):i*5,a=i*Math.PI/6;
   return `<button type="button" class="clock-number" data-value="${n}" aria-label="${n}${part==='hour'?'시':'분'}" aria-pressed="${part==='hour'?hour%12===i:minute===n}" style="left:${50+39*Math.sin(a)}%;top:${50-39*Math.cos(a)}%">${part==='hour'?n:pad(n)}</button>`;
  }).join('');
  dialog.querySelectorAll('[data-value]').forEach(b=>b.onclick=()=>{choose(Number(b.dataset.value));if(part==='hour')part='minute';paint();dialog.querySelector('[data-part="'+part+'"]').focus();});
  dialog.querySelector('.dial-value').textContent=`${hour>=12?'오후':'오전'} ${hour%12||12}시 ${pad(minute)}분 · ${pad(hour)}:${pad(minute)}`;
 };
 const choose=n=>{if(part==='hour')hour=(n%12)+(hour>=12?12:0);else minute=n;};
 dialog.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>{part=b.dataset.part;paint();});
 dialog.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{hour=hour%12+(b.dataset.period==='pm'?12:0);paint();});
 const face=dialog.querySelector('.clock-face');let dragging=false;
 const point=e=>{const r=face.getBoundingClientRect();const angle=(Math.atan2(e.clientX-r.left-r.width/2,-(e.clientY-r.top-r.height/2))*180/Math.PI+360)%360;const n=Math.round(angle/30)%12;choose(part==='hour'?n:n*5);paint();};
 face.onpointerdown=e=>{if(e.target.closest('button'))return;e.preventDefault();dragging=true;face.setPointerCapture(e.pointerId);point(e);};
 face.onpointermove=e=>{if(dragging)point(e);};face.onpointerup=()=>{if(dragging){dragging=false;if(part==='hour'){part='minute';paint();}}};face.onpointercancel=()=>{dragging=false;};
 dialog.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>dialog.close());
 dialog.querySelector('[data-apply]').onclick=()=>{onSelect(`${pad(hour)}:${pad(minute)}`);dialog.close();};
 dialog.addEventListener('close',()=>{dialog.remove();trigger?.focus();},{once:true});
 paint();dialog.showModal();dialog.querySelector('[data-part=hour]').focus();
}
