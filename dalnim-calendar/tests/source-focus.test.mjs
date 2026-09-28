import test from 'node:test';
import assert from 'node:assert/strict';
import {focusTerms,relatedExcerpts,sourceLines,timestampLink,youtubeSource} from '../src/core/source-focus.js';
import {verificationGuide,planFor} from '../src/core/verification.js';
import {renderSourceFocus} from '../src/components/source-panel.js';
const question='📺 영상ADI(아날로그 디바이스) 실적 발표 일정 확인 및 EMA 저항대(100~120달러) 돌파 여부';
const line='아날로그 디바이스 (ADI) | 시험 가격 99달러 | EMA 저항 100~120달러 | 실적 발표 이후 종가와 비교하는 합성 자료입니다.';
const source={id:'yt_abcdefghijk',title:'합성 시험 요약',date:'2026-09-18',url:'https://example.com/summary',body:'■ 전체 설명\n다른 기업의 실적과 산업 전체의 전망을 설명하는 일반 내용으로 질문의 기업과 무관합니다.\n\n■ 종목 분석\n'+line+'\n\n■ 체크 캘린더\n'+question+' | 시험 후속 행동'};
test('related passages prioritize the entity, values and metric; not the repeated calendar task',()=>{
 const found=relatedExcerpts(source,question);assert.equal(found[0].text,line);assert.equal(found[0].heading,'종목 분석');assert.equal(source.body.slice(found[0].start,found[0].end),line);assert.equal(found.length,1);assert.ok(!focusTerms(question).includes('여부'));
});
test('no strong passage produces an explicit empty result instead of presenting an unrelated opening',()=>{
 assert.deepEqual(relatedExcerpts({...source,body:'이 문서는 전체 시장의 다양한 소식을 모아 둔 자료이며 대상 기업이나 수치가 들어 있지 않습니다.'},question),[]);
 assert.match(renderSourceFocus({title:question,integration:{question}},{sources:[{...source,body:'관련 자료 없음'}]},true),/대응하는 문장을 찾지 못/);
});
test('exact offsets survive Korean, emoji, duplicate paragraphs and very long paragraphs',()=>{
 const input={...source,body:'🌓 앞말\n'+line+'\n'+line+'\n'+'앞말 '.repeat(400)+line+' 뒷말'.repeat(400)};
 const found=relatedExcerpts(input,question);assert.equal(found.filter(x=>x.text===line).length,1);for(const x of found){assert.equal(x.text,input.body.slice(x.start,x.end));assert.ok(x.text.length<=950);}
 assert.equal(sourceLines('가\n나')[1].start,2);
});
test('video jumps require a known video source and a timestamp attached to the excerpt',()=>{
 const timed=relatedExcerpts({...source,body:'■ 종목\n[12:34]\n'+line},question)[0];assert.equal(timed.time.seconds,754);assert.equal(new URL(timed.time.url).searchParams.get('t'),'754s');
 assert.equal(timestampLink(source,'발표 일정 12:34, 가격 비율 12:34'),null);
 assert.equal(timestampLink({id:'not-video',url:'https://example.com'},'[12:34] 발언'),null);
 assert.equal(relatedExcerpts({...source,body:'[01:20]\n전혀 관계없는 문장\n'+line},question)[0].time,null);
 assert.equal(timestampLink(source,'[1:70:20] 발언'),null);
 assert.equal(youtubeSource({url:'https://youtube.com.evil.example/watch?v=x',id:'x'}),'');
 assert.equal(youtubeSource({url:'https://www.youtube.com/@channel',id:'x'}),'');
});
test('source content and outbound links remain inert when rendering excerpts',()=>{
 const html=renderSourceFocus({title:question,integration:{question}},{sources:[{...source,title:'<script>bad</script>',body:line+' <img src=x onerror=alert(1)>',url:'javascript:alert(1)'}]},true);
 assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('본문 이 문장으로'));assert.ok(html.includes('원영상 · 시각 미기록'));
});
test('ADI guidance carries only the question price range, distinguishes dates and preserves saved edits',()=>{
 const guide=verificationGuide({question});assert.match(guide.compareWith,/100~120달러/);assert.match(guide.criteria,/확인 예정일/);assert.ok(guide.sources.every(s=>s.url.startsWith('https://investor.analog.com/')));
 assert.equal(planFor({question,verificationPlan:{findWhat:'내가 지정한 확인 기준'}}).findWhat,'내가 지정한 확인 기준');
});
