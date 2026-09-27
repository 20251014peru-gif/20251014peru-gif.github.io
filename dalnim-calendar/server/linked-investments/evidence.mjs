import {matchingCases,safeEvidenceURL} from '../../src/core/verification.js';
const text=(v,n=20000)=>typeof v==='string'?v.slice(0,n):'';
// No source HTML is rendered. Rich study documents expose text nodes only.
function richText(node,depth=0){if(!node||depth>20)return '';if(typeof node.text==='string')return node.text;return Array.isArray(node.content)?node.content.map(n=>richText(n,depth+1)).join('\n'):'';}
export function sourceContext(record,snapshot={}){
 if(!record)return {id:snapshot.id,title:text(snapshot.title,500),url:safeEvidenceURL(snapshot.url),missing:true};
 return {id:record.id,title:text(record.title,500),date:text(record.date,20),url:safeEvidenceURL(record.link||snapshot.url),body:text(record.body||record.oneLiner||richText(record.content)),missing:false};
}
export function evidenceSnapshot(f){return {id:f.id,question:f.question||'',expectation:f.expectation||'',dueAt:f.dueAt||'',basisDate:f.basisDate||'',result:f.result||'',comparison:f.comparison||'',judgment:f.judgment||'pending',changeReason:f.changeReason||'',observedChange:f.observedChange||'',lesson:f.lesson||'',nextAction:f.nextAction||'',links:f.links||[],verificationPlan:f.verificationPlan||null,state:f.state||'',revision:f.revision||0,recordedAt:f.recordedAt||f.completedAt||f.updatedAt||null,sourceIds:f.sourceIds||[]};}
export function caseResults(current,rows){const matches=matchingCases(current,rows);return {total:matches.length,items:matches.slice(0,20).map(evidenceSnapshot)};}
