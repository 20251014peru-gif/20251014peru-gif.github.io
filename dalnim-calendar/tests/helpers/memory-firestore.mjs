export function memoryFirestore(seed={}){
 const data=new Map(Object.entries(structuredClone(seed)));let beforeCommit=null;
 const snapshot=(path)=>({id:path.split('/').at(-1),ref:doc(path),exists:data.has(path),data:()=>structuredClone(data.get(path))});
 function doc(path){return {path,id:path.split('/').at(-1),collection:name=>collection(path+'/'+name),get:async()=>snapshot(path),set:async(value,options)=>{data.set(path,options?.merge?{...data.get(path),...structuredClone(value)}:structuredClone(value));}};}
 function collection(path,filters=[],limit=Infinity){return {path,doc:id=>doc(path+'/'+id),where:(key,op,value)=>collection(path,[...filters,[key,op,value]],limit),limit:n=>collection(path,filters,n),get:async()=>{
  const docs=[...data.keys()].filter(k=>k.startsWith(path+'/')&&!k.slice(path.length+1).includes('/')).filter(k=>filters.every(([key,op,value])=>{if(op!=='==')throw Error('Unsupported test query');return key.split('.').reduce((v,k)=>v?.[k],data.get(k))===value;})).slice(0,limit).map(snapshot);
  return {docs,size:docs.length,empty:!docs.length};
 }};}
 return {data,collection,beforeCommit:fn=>{beforeCommit=fn;},async runTransaction(work){
  const writes=[];let writing=false;const result=await work({get:async ref=>{if(writing)throw Error('Transaction read after write');return ref.get();},set:(ref,value,options)=>{writing=true;writes.push([ref,value,options]);}});
  if(beforeCommit){const fn=beforeCommit;beforeCommit=null;await fn();throw Object.assign(Error('simulated transaction failure'),{code:10});}
  for(const [ref,value,options]of writes)await ref.set(value,options);return result;
 }};
}
