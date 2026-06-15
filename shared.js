/* ===== SHARED JS v1.0-20260615 ===== */
const FB_PROJECT = 'my-system-25497';
const FB_API_KEY = 'AIzaSyAyG1chECYsbO7cSZUuXmNa0_KDYBmahPY';
const FB_BASE = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`;

// Firestore helpers
function toFS(data){
  const fields={};
  for(const[k,v]of Object.entries(data)){
    if(v===null||v===undefined){fields[k]={nullValue:null};continue}
    if(typeof v==='boolean')fields[k]={booleanValue:v};
    else if(typeof v==='number')fields[k]={doubleValue:v};
    else if(typeof v==='string')fields[k]={stringValue:v};
    else if(Array.isArray(v)||typeof v==='object')fields[k]={stringValue:JSON.stringify(v)};
  }
  return{fields};
}
function fromFS(doc){
  const obj={id:doc.name.split('/').pop()};
  for(const[k,v]of Object.entries(doc.fields||{})){
    if(v.stringValue!==undefined){
      const s=v.stringValue;
      if((s.startsWith('[')||s.startsWith('{'))&&!['url','link','refLink','phone','address'].includes(k)){
        try{obj[k]=JSON.parse(s)}catch{obj[k]=s}
      }else obj[k]=s;
    }
    else if(v.booleanValue!==undefined)obj[k]=v.booleanValue;
    else if(v.doubleValue!==undefined)obj[k]=v.doubleValue;
    else if(v.integerValue!==undefined)obj[k]=parseInt(v.integerValue);
    else if(v.nullValue!==undefined)obj[k]=null;
  }
  return obj;
}
async function fsGet(col){
  try{
    const r=await fetch(`${FB_BASE}/${col}?key=${FB_API_KEY}&pageSize=300`);
    if(!r.ok)return[];
    const d=await r.json();
    return(d.documents||[]).map(fromFS);
  }catch{return[]}
}
async function fsSet(col,id,data){
  const r=await fetch(`${FB_BASE}/${col}/${id}?key=${FB_API_KEY}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(toFS(data))});
  return r.ok;
}
async function fsDelete(col,id){
  const r=await fetch(`${FB_BASE}/${col}/${id}?key=${FB_API_KEY}`,{method:'DELETE'});
  return r.ok;
}
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

// Utils
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function formatDate(ts){if(!ts)return'';const d=new Date(typeof ts==='number'?ts:parseInt(ts));return`${d.getMonth()+1}/${d.getDate()}`}
function formatDateFull(ts){if(!ts)return'';const d=new Date(typeof ts==='number'?ts:parseInt(ts));return`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function tsToDate(ts){if(!ts)return'';const d=new Date(typeof ts==='number'?ts:parseInt(ts));return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const TAG_COLORS=['tag-pk','tag-mn','tag-lv','tag-yw','tag-bl','tag-or'];
function tagColor(i){return TAG_COLORS[i%TAG_COLORS.length]}

function toast(msg){
  let t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}
  t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2200);
}

// Image helpers
function addImageFromFile(file,arr,renderFn){
  const reader=new FileReader();
  reader.onload=e=>{arr.push(e.target.result);renderFn()};
  reader.readAsDataURL(file);
}
async function pasteImageClipboard(arr,renderFn){
  try{
    const items=await navigator.clipboard.read();
    for(const item of items){
      for(const type of item.types){
        if(type.startsWith('image/')){const blob=await item.getType(type);addImageFromFile(blob,arr,renderFn);return}
      }
    }
    toast('클립보드에 이미지가 없어요');
  }catch{toast('Ctrl+V로 붙여넣기 해주세요')}
}

// Tag input widget
function initTagInput(wrapId,tagsArr,color='pk'){
  const wrap=document.getElementById(wrapId);
  if(!wrap)return;
  function render(){
    wrap.innerHTML='';
    tagsArr.forEach((t,i)=>{
      const chip=document.createElement('span');
      chip.className=`tag-chip`;
      chip.style.background=`var(--${color})`;chip.style.color=`var(--${color}3)`;
      chip.innerHTML=`${esc(t)}<button class="tag-chip-del" onclick="tagsArr.splice(${i},1);renderTagsRef()">✕</button>`;
      wrap.appendChild(chip);
    });
    const inp=document.createElement('input');
    inp.className='tag-input-field';inp.placeholder='태그 입력 후 Enter';
    inp.onkeydown=e=>{
      if((e.key==='Enter'||e.key===',')&&inp.value.trim()){
        e.preventDefault();const v=inp.value.trim().replace(/,$/,'');
        if(v&&!tagsArr.includes(v)){tagsArr.push(v);render()}
        else inp.value='';
      }
      if(e.key==='Backspace'&&!inp.value&&tagsArr.length){tagsArr.pop();render()}
    };
    wrap.appendChild(inp);
  }
  render();
  return{render};
}

// Theme
function setupTheme(accentVar='--pk3'){
  const dm=localStorage.getItem('lr_dark')==='1';
  if(dm)document.body.classList.add('dark');
  document.querySelectorAll('[id$="darkModeToggle"]').forEach(t=>{t.checked=dm;t.onchange=toggleDark});
  document.getElementById('darkToggle')?.addEventListener('click',toggleDark);
}
function toggleDark(){
  document.body.classList.toggle('dark');
  localStorage.setItem('lr_dark',document.body.classList.contains('dark')?'1':'0');
  document.querySelectorAll('[id$="darkModeToggle"]').forEach(t=>t.checked=document.body.classList.contains('dark'));
}

// Tab switching
function setupTabs(tabIds,onSwitch){
  document.querySelectorAll('.btab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const tab=btn.dataset.tab;
      document.querySelectorAll('.btab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      document.getElementById('tab-'+tab)?.classList.add('active');
      onSwitch?.(tab);
    });
  });
}

// Backup helpers
async function doBackup(colName,getData){
  const snap={timestamp:Date.now(),data:getData()};
  const id='backup_'+Date.now();
  await fsSet(colName+'_backups',id,{snap:JSON.stringify(snap),timestamp:Date.now()});
  localStorage.setItem(colName+'_lastBackup',Date.now().toString());
  toast('백업 완료 ✓');
  await cleanOldBackups(colName+'_backups');
}
async function cleanOldBackups(col){
  const all=await fsGet(col);
  all.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
  for(let i=5;i<all.length;i++)await fsDelete(col,all[i].id);
}
function exportJson(data,filename){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();
  toast('JSON 내보내기 완료');
}

// Calendar
function renderCalendarBase({year,month,items,getDateStr,getEntries,getEntryClass,onDayClick,zoomClass}){
  const grid=document.getElementById('calGrid');
  if(!grid)return;
  grid.className=`cal-grid zoom-${zoomClass||'md'}`;
  const dow=document.getElementById('calDow');
  if(dow)dow.innerHTML=['일','월','화','수','목','금','토'].map(d=>`<div class="cal-dow">${d}</div>`).join('');
  const first=new Date(year,month,1).getDay();
  const days=new Date(year,month+1,0).getDate();
  const today=new Date();
  const maxE=zoomClass==='sm'?1:zoomClass==='lg'?3:2;
  let cells='';
  for(let i=first-1;i>=0;i--){
    const pd=new Date(year,month,0).getDate()-i;
    cells+=`<div class="cal-cell other-month"><span class="cal-day-num">${pd}</span></div>`;
  }
  for(let d=1;d<=days;d++){
    const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayItems=items.filter(it=>tsToDate(it.createdAt)===dateStr);
    const isToday=today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===d;
    const dow2=new Date(year,month,d).getDay();
    let ents='';let cnt=0;
    for(const it of dayItems){
      if(cnt>=maxE)break;
      const cls=getEntryClass(it);
      const lbl=getEntries(it);
      ents+=`<div class="cal-entry ${cls}" title="${esc(lbl)}">${esc(lbl.slice(0,zoomClass==='lg'?10:6))}</div>`;
      cnt++;
    }
    const rem=dayItems.length-cnt;
    if(rem>0)ents+=`<div class="cal-more">+${rem}개</div>`;
    cells+=`<div class="cal-cell${isToday?' today':''}${dow2===0?' sunday':dow2===6?' saturday':''}" onclick="${onDayClick}('${dateStr}')"><span class="cal-day-num">${d}</span>${ents}</div>`;
  }
  const total=Math.ceil((first+days)/7)*7;
  for(let d=1;d<=total-(first+days);d++)cells+=`<div class="cal-cell other-month"><span class="cal-day-num">${d}</span></div>`;
  grid.innerHTML=cells;
}

// Addressbook sync
async function syncToAddressbook(name,phone,address,category){
  if(!phone&&!address)return;
  const all=await fsGet('ab_contacts');
  const existing=all.find(c=>c.name===name);
  if(existing){
    const updated={...existing};
    if(phone)updated.phone=phone;
    if(address)updated.address=address;
    await fsSet('ab_contacts',existing.id,updated);
  }else{
    const id=genId();
    await fsSet('ab_contacts',id,{name,phone:phone||'',address:address||'',category:category||'자재업체',createdAt:Date.now()});
  }
}
async function getAddressbookSuggestions(query){
  if(!query||query.length<1)return[];
  const all=await fsGet('ab_contacts');
  return all.filter(c=>c.name&&c.name.includes(query));
}

// Open link in native app
function openLink(url){
  if(!url)return;
  if(url.includes('instagram.com')){
    const path=url.replace('https://www.instagram.com','').replace('https://instagram.com','');
    window.location.href='instagram://'+path;
    setTimeout(()=>window.open(url,'_blank'),1500);
  }else if(url.includes('youtube.com')||url.includes('youtu.be')){
    const vid=url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1];
    if(vid){window.location.href='youtube://'+vid;setTimeout(()=>window.open(url,'_blank'),1500);}
    else window.open(url,'_blank');
  }else{
    window.open(url,'_blank');
  }
}
function openNaver(address){
  const q=encodeURIComponent(address);
  window.location.href=`nmap://search?query=${q}&appname=com.example.myapp`;
  setTimeout(()=>window.open(`https://map.naver.com/v5/search/${q}`,'_blank'),1500);
}
function openTel(phone){window.location.href='tel:'+phone.replace(/[^0-9+]/g,'')}
