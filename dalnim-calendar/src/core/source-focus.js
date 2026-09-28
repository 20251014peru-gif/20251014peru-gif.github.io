import {safeEvidenceURL} from './verification.js';
// Locators into saved source text. These excerpts are never rewritten as quotes
// from the speaker; imported summaries may contain their author's interpretation.
const noise=new Set(['영상','직전','직접','확인','여부','일정','내용','기록','결과','변화','발언','의장','관련','대한','그리고','현재','발표일','달러','그때']);
const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
export function focusTerms(question){return [...new Set((String(question).match(/[A-Za-z]{2,}|[가-힣]{2,}|\d+(?:\.\d+)?/g)||[]).map(s=>s.replace(/^(영상|직전|직접)(?=[가-힣]{2})/,'')))].filter(s=>!noise.has(s)&&s.length>1).slice(0,24);}
export function sourceLines(body){
 let offset=0,heading='저장된 본문';return String(body||'').split('\n').map((text,index)=>{const start=offset;offset+=text.length+1;if(/^\s*■/.test(text))heading=text.replace(/[■▸▾]/g,'').trim();return {text,start,end:start+text.length,index,heading};});
}
export function youtubeSource(source){
 const url=safeEvidenceURL(source.url);
 if(url){const u=new URL(url);let id='';if(u.hostname==='youtu.be')id=u.pathname.slice(1);else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname))id=u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)$/)?.[1];if(/^[a-zA-Z0-9_-]{11}$/.test(id||''))return u.href;}
 const match=String(source.id||'').match(/^yt_([a-zA-Z0-9_-]{11})$/);return match?'https://www.youtube.com/watch?v='+match[1]:'';
}
export function timestampLink(source,text){
 const base=youtubeSource(source);if(!base)return null;
 // Require an explicit bracketed video time within this same excerpt. Never use
 // the follow-up date, unrelated preceding times, price ratios, or guessed offsets.
 const m=String(text).match(/(?:^|\n)\s*\[((?:\d{1,2}:)?\d{1,2}:[0-5]\d)\]/);if(!m)return null;
 const parts=m[1].split(':').map(Number);if(parts.length===3&&parts[1]>59)return null;
 const seconds=parts.reduce((a,b)=>a*60+b,0);const u=new URL(base);u.searchParams.delete('start');u.searchParams.set('t',String(seconds)+'s');return {url:u.href,label:m[1],seconds};
}
export function relatedExcerpts(source,question){
 const body=String(source.body||''),terms=focusTerms(question),q=normalize(question),lines=sourceLines(body);
 const ranked=lines.filter(l=>l.text.trim().length>=32&&!/목차|체크 캘린더/.test(l.heading)&&!/^\s*[↑▾■]/.test(l.text)&&!(q.length>15&&normalize(l.text).includes(q))).map(l=>{
  const lower=l.text.toLowerCase(),matched=terms.filter(t=>lower.includes(t.toLowerCase()));
  const score=matched.reduce((s,t)=>s+(/^[a-z]{2,6}$/i.test(t)?5:/^\d/.test(t)?4:2),0);
  return {...l,matched,score};
 }).filter(l=>l.matched.length>=2||l.matched.some(t=>/^[A-Z]{2,6}$/.test(t))).sort((a,b)=>b.score-a.score||a.start-b.start);
 const picked=[];
 for(const row of ranked){
  if(picked.some(x=>normalize(x.text)===normalize(row.text)))continue;
  let start=row.start,end=row.end;
  // Keep a directly attached bracketed timestamp; do not borrow earlier times.
  const previous=lines[row.index-1];if(previous&&/^\s*\[(?:\d{1,2}:)?\d{1,2}:[0-5]\d\]\s*$/.test(previous.text))start=previous.start;
  if(end-start>950){const lower=body.slice(start,end).toLowerCase();let at=0,best=-1;for(const term of row.matched){const p=lower.indexOf(term.toLowerCase()),window=lower.slice(Math.max(0,p-100),p+650),weight=row.matched.filter(t=>window.includes(t.toLowerCase())).length;if(weight>best){best=weight;at=p;}}start+=Math.max(0,at-100);end=Math.min(end,start+900);}
  const text=body.slice(start,end);picked.push({start,end,text,heading:row.heading,matched:row.matched,time:timestampLink(source,text)});if(picked.length===3)break;
 }
 return picked;
}
