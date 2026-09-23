export const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
calendar:'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2zm2 10h3m4 0h3m-10 4h3',
list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
search:'M21 21l-5-5m2-6a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
plus:'M12 5v14M5 12h14',close:'M6 6l12 12M6 18L18 6',
chevron:'M9 5l7 7-7 7',building:'M4 21V3h12v18M16 9h4v12M8 7h4m-4 4h4m-4 4h4M9 21v-3h2v3',
chart:'M3 3v18h18M6 15l4-5 4 3 6-8',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7a4 4 0 0 1 0 8',
clock:'M12 8v5l3 2m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4',
blocks:'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm14-1v10m-5-5h10',
settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
download:'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',upload:'M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5',
check:'M5 12l4 4L19 6',arrow:'M5 12h14m-6-6 6 6-6 6',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
home:'M3 10l9-7 9 7M5 9v12h5v-7h4v7h5V9',menu:'M4 6h16M4 12h16M4 18h16',
print:'M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6z',
link:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
moon:'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11',info:'M12 11v6m0-10v.1m9 4.9a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
};
export const icon=(name,cls='')=>'<svg class="icon '+cls+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[name]||paths.calendar)+'"/></svg>';
export const button=(action,label,ico,cls='')=>'<button class="'+cls+'" data-action="'+action+'">'+(ico?icon(ico):'')+'<span>'+label+'</span></button>';
let timer;
export function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('show'),4200);}
export function ask(title,message,confirm='확인'){
 const d=document.getElementById('confirm');d.innerHTML='<form method="dialog" class="confirm-box"><h2 id="confirm-title">'+esc(title)+'</h2><p>'+esc(message)+'</p><div class="dialog-actions"><button value="cancel" class="soft">취소</button><button value="ok" class="primary">'+esc(confirm)+'</button></div></form>';d.showModal();return new Promise(resolve=>d.addEventListener('close',()=>resolve(d.returnValue==='ok'),{once:true}));
}
// Like ask(), but with N labelled choices instead of a single confirm — used to pick "this event only" vs "all". Resolves the clicked value, or null when cancelled.
export function chooseScope(title,message,options){
 const d=document.getElementById('confirm');d.innerHTML='<form method="dialog" class="confirm-box"><h2 id="confirm-title">'+esc(title)+'</h2><p>'+esc(message)+'</p><div class="dialog-actions">'+options.map(o=>'<button value="'+esc(o.value)+'" class="'+(o.cls||'soft')+'">'+esc(o.label)+'</button>').join('')+'<button value="" class="soft" formnovalidate>취소</button></div></form>';d.showModal();return new Promise(resolve=>d.addEventListener('close',()=>resolve(d.returnValue||null),{once:true}));
}
export function download(name,data,type='application/json'){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([data],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
// Shared by modules that need their own address + phone (not the generic location field): a
// module-scoped 주소 always links to Naver Map, 전화번호 always links to tel: — no guessing needed
// because the fields are already separate, unlike the old combined "장소" field.
export function addressPhoneFieldsHtml(draft,field){
 return field('주소','<input data-detail="address" maxlength="300" placeholder="주소를 입력하세요" value="'+esc(draft.address??'')+'"><p class="form-note" data-address-link></p>')
  +field('전화번호','<input data-detail="phone" type="tel" maxlength="40" placeholder="010-0000-0000" value="'+esc(draft.phone??'')+'"><p class="form-note" data-phone-link></p>');
}
export function wireAddressPhoneLinks(host){
 const addr=host.querySelector('[data-detail="address"]'),addrLink=host.querySelector('[data-address-link]');
 const phone=host.querySelector('[data-detail="phone"]'),phoneLink=host.querySelector('[data-phone-link]');
 const set=(input,link,build)=>{if(!input||!link)return;const v=(input.value||'').trim();link.innerHTML=v?build(v):'';};
 const refresh=()=>{
  set(addr,addrLink,v=>'<a href="https://map.naver.com/p/search/'+encodeURIComponent(v)+'" target="_blank" rel="noopener">'+icon('link')+'네이버 지도에서 보기</a>');
  set(phone,phoneLink,v=>'<a href="tel:'+esc(v.replace(/[^0-9+]/g,''))+'">'+icon('link')+'전화 걸기</a>');
 };
 addr?.addEventListener('input',refresh);phone?.addEventListener('input',refresh);refresh();
}

