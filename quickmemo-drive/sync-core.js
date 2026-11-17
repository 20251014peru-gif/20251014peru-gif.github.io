(function(root){
'use strict';
const keys=['id','type','body','person','scope','direction','amount','category','created','images','star','done','deleted'];
function clean(n){return Object.fromEntries(keys.map(k=>[k,n[k]??(k==='images'?[]:'')]))}
function signature(n){return JSON.stringify(clean(n))}
function valid(r){return r&&r.v===1&&/^[\w-]{1,160}$/.test(r.rid)&&Array.isArray(r.parents)&&r.parents.every(x=>/^[\w-]{1,160}$/.test(x))&&r.note&&/^[\w-]{1,160}$/.test(r.note.id)&&typeof r.note.body==='string'&&typeof r.note.created==='string'&&Number.isFinite(Date.parse(r.note.created))&&typeof r.note.updated==='string'&&Array.isArray(r.note.images)&&r.note.images.every(x=>/^[\w-]{1,160}$/.test(x))&&r.assets&&r.note.images.every(x=>/^[a-f0-9]{64}$/.test(r.assets[x]||''))}
function groups(revisions){const result=new Map();for(const r of revisions){if(!valid(r))throw Error('지원하지 않는 클라우드 기록');if(!result.has(r.note.id))result.set(r.note.id,[]);result.get(r.note.id).push(r)}return result}
function heads(rs){const superseded=new Set(rs.flatMap(r=>r.parents));return rs.filter(r=>!superseded.has(r.rid)).sort((a,b)=>a.rid.localeCompare(b.rid))}
const api={clean,signature,valid,groups,heads};if(typeof module!=='undefined')module.exports=api;else root.QMSyncCore=api;
})(typeof window==='undefined'?{}:window);
