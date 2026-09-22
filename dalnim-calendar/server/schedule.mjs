import {DateTime} from 'luxon';
export function nextReminder(e,now=Date.now(),afterStart=0){
 if(e.deletedAt||e.status==='done'||e.reminder<0)return null;
 const zone=e.timeZone||'Asia/Seoul',anchor=DateTime.fromISO(e.start,{zone}).setZone(zone);
 if(!anchor.isValid)throw Error('올바른 시간대를 지정해 주세요.');
 // All-day reminders are anchored at 09:00 in the event's time zone.
 const base=e.allDay?anchor.set({hour:9}):anchor;
 const clock=DateTime.fromMillis(Math.max(now,afterStart),{zone});
 let from=e.repeat==='daily'?Math.floor(clock.diff(base,'days').days)-2:e.repeat==='weekly'?Math.floor(clock.diff(base,'weeks').weeks)-2:e.repeat==='monthly'?Math.floor(clock.diff(base,'months').months)-2:e.repeat==='yearly'?Math.floor(clock.diff(base,'years').years)-2:0;
 for(let n=Math.max(0,from),i=0;i<400;n++,i++){
  if(e.repeat==='none'&&n>0)break;
  const d=e.repeat==='daily'?base.plus({days:n}):e.repeat==='weekly'?base.plus({weeks:n}):e.repeat==='monthly'?base.plus({months:n}):e.repeat==='yearly'?base.plus({years:n}):base;
  if((e.repeat==='monthly'||e.repeat==='yearly')&&d.day!==base.day)continue;
  if(d.toMillis()<=afterStart||d.toMillis()<now-60000)continue;
  // A per-occurrence exception (edited or deleted single instance) is keyed by its original anchor instant.
  const anchorKey=e.allDay?d.toISODate():d.toUTC().toISO();
  const ex=e.exceptions?.[anchorKey];
  if(ex?.deletedAt||ex?.status==='done')continue;
  const reminder=Number.isInteger(ex?.reminder)?ex.reminder:e.reminder;
  if(reminder<0)continue;
  const overrideStart=ex?.start?DateTime.fromISO(ex.start,{zone}):null;
  const occurAt=overrideStart?(e.allDay?overrideStart.set({hour:9}):overrideStart).toMillis():d.toMillis();
  return {occurrence:d.toMillis(),dueAt:Math.max(now,occurAt-reminder*60000)};
 }
 return null;
}

