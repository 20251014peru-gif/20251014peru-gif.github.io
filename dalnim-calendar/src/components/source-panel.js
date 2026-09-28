import {esc} from '../ui.js';
import {relatedExcerpts,sourceLines,youtubeSource,timestampLink} from '../core/source-focus.js';
import {safeEvidenceURL} from '../core/verification.js';
const excerptsFor=(s,q)=>s.kind==='prediction'&&s.body?[{start:0,end:s.body.length,text:s.body,heading:'저장된 예측 발언',matched:[],time:timestampLink(s,s.body)}]:relatedExcerpts(s,q);
const external=(url,label)=>safeEvidenceURL(url)?'<a class="source-action" target="_blank" rel="noopener noreferrer" href="'+esc(safeEvidenceURL(url))+'">'+esc(label)+' ↗</a>':'';
const marked=(value,terms)=>{
 const spans=[];for(const term of terms){let from=0;const lower=value.toLowerCase(),needle=term.toLowerCase();while(from<value.length){const at=lower.indexOf(needle,from);if(at<0)break;spans.push([at,at+term.length]);from=at+term.length;}}
 spans.sort((a,b)=>a[0]-b[0]);let out='',at=0;for(const [start,end]of spans){if(start<at)continue;out+=esc(value.slice(at,start))+'<mark>'+esc(value.slice(start,end))+'</mark>';at=end;}return out+esc(value.slice(at));
};
export function renderSourceFocus(record,evidence,editable){
 const question=record.integration.question||record.title,sources=evidence?.sources||[];
 if(!sources.length)return '<p class="evidence-empty">연결된 원문을 불러오지 못했거나 연결된 자료가 없습니다. 아래 원본 열기에서 확인해 주세요.</p>';
 return '<div class="source-excerpts">'+sources.map((s,si)=>{
  const excerpts=excerptsFor(s,question),video=youtubeSource(s);
  return '<article class="focused-source"><header><strong>'+esc(s.title||'연결된 기록')+'</strong><span>'+esc(s.date||'작성일 미기록')+' · 저장된 요약</span></header>'+
   (s.missing?'<p class="evidence-empty">원본이 삭제되었거나 없습니다.</p>':excerpts.length?excerpts.map((e,ei)=>{
    const content='<p class="excerpt-location">'+esc(e.heading)+'</p><blockquote>'+marked(e.text,e.matched)+'</blockquote><div class="source-actions"><button class="source-action" type="button" data-source-reader="'+si+'" data-excerpt="'+ei+'">본문 이 문장으로</button>'+external(e.time?.url,e.time?'영상 '+e.time.label+'부터':'')+(editable?'<button class="source-action" type="button" data-use-excerpt="'+si+'" data-excerpt="'+ei+'">당시 주장에 넣기</button>':'')+'</div>';
    return ei===0?'<div class="primary-excerpt">'+content+'</div>':'<details class="other-excerpt"><summary>관련 문장 '+(ei+1)+' · '+esc(e.heading)+'</summary>'+content+'</details>';
   }).join(''):'<p class="evidence-empty">이 질문과 뚜렷하게 대응하는 문장을 찾지 못했습니다. 본문에서 검색어를 직접 찾아 주세요.</p>')+
   '<div class="source-actions source-footer">'+(s.body?'<button class="source-action" type="button" data-source-reader="'+si+'">본문 직접 찾기</button>':'')+external(s.url,'연결 자료')+(!excerpts.some(x=>x.time)?external(video,'원영상 · 시각 미기록'):'')+'</div>'+
   (s.body?.length>=20000?'<p class="form-note">현재 불러온 본문 범위에서 찾았습니다. 뒤쪽 내용은 연결 자료에서 확인해 주세요.</p>':'')+'</article>';
 }).join('')+'<p class="form-note">'+(sources.every(s=>s.kind==='prediction')?'예측 대장에 저장된 발언 요지입니다.':'관련 단어가 함께 나온 저장 문장을 발췌했습니다.')+' 요약자의 해석이 포함될 수 있으며 원영상의 직접 인용으로 확정한 문장은 아닙니다.</p></div>'+
 '<section class="source-reader" hidden aria-label="관련 문장 본문 보기"><header><button type="button" class="soft" data-reader-back>← 발췌로 돌아가기</button><span data-reader-location></span></header><div class="reader-search"><input type="search" aria-label="이 본문에서 찾기" placeholder="이 본문에서 찾기"><button type="button" class="soft" data-reader-next>다음</button><span role="status" data-reader-status></span></div><div class="source-reader-body" tabindex="0"></div></section>';
}
export function mountSourceFocus(form,record,evidence){
 const sources=evidence?.sources||[],reader=form.querySelector('.source-reader');if(!reader)return;
 const question=record.integration.question||record.title,body=reader.querySelector('.source-reader-body'),search=reader.querySelector('input'),status=reader.querySelector('[data-reader-status]');let matches=[],cursor=-1;
 const showMatch=()=>{body.querySelectorAll('.reader-current').forEach(x=>x.classList.remove('reader-current'));const target=matches[cursor];if(target){target.classList.add('reader-current');target.scrollIntoView({block:'center'});}status.textContent=matches.length?(cursor+1)+' / '+matches.length:'일치하는 문장 없음';};
 const doSearch=()=>{const q=search.value.trim().toLowerCase();matches=[...body.querySelectorAll('[data-source-line]')].filter(p=>q&&p.textContent.toLowerCase().includes(q));cursor=matches.length?0:-1;showMatch();};
 let returnTo;
 form.querySelectorAll('[data-source-reader]').forEach(button=>button.onclick=()=>{
  const source=sources[Number(button.dataset.sourceReader)];if(!source)return;returnTo=button;
  const excerpt=button.dataset.excerpt===undefined?null:excerptsFor(source,question)[Number(button.dataset.excerpt)];
  body.innerHTML=sourceLines(source.body).filter(x=>x.text.trim()).map(line=>'<p data-source-line="'+line.index+'" data-start="'+line.start+'" data-end="'+line.end+'">'+esc(line.text)+'</p>').join('');
  reader.querySelector('[data-reader-location]').textContent=source.title||'연결된 본문';reader.hidden=false;search.value='';matches=[];cursor=-1;
  const target=excerpt?[...body.querySelectorAll('[data-source-line]')].find(p=>Number(p.dataset.end)>excerpt.start&&Number(p.dataset.start)<excerpt.end):null;
  if(target){target.classList.add('reader-current');target.scrollIntoView({block:'center'});status.textContent='선택한 관련 문장으로 이동했어요.';body.focus({preventScroll:true});}else{body.scrollTop=0;status.textContent='검색어를 입력해 본문에서 찾을 수 있어요.';search.focus({preventScroll:true});}
 });
 search.addEventListener('input',ev=>{ev.stopPropagation();doSearch();});search.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();if(matches.length){cursor=(cursor+1)%matches.length;showMatch();}}});
 reader.querySelector('[data-reader-next]').onclick=()=>{if(matches.length){cursor=(cursor+1)%matches.length;showMatch();}};
 reader.querySelector('[data-reader-back]').onclick=()=>{reader.hidden=true;returnTo?.focus({preventScroll:true});};
 form.querySelectorAll('[data-use-excerpt]').forEach(button=>button.onclick=()=>{
  const source=sources[Number(button.dataset.useExcerpt)],excerpt=excerptsFor(source,question)[Number(button.dataset.excerpt)],field=form.elements.namedItem('plan.claim');if(!field||!excerpt)return;
  const next='[저장된 요약 발췌 · '+(source.date||'날짜 미기록')+']\n'+excerpt.text+(excerpt.time?'\n'+excerpt.time.url:'');
  if(field.value.trim()&&!confirm('작성한 당시 주장 내용을 이 발췌로 바꿀까요?'))return;
  field.value=next;field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();
 });
 return {closeReader:()=>{reader.hidden=true;}};
}
