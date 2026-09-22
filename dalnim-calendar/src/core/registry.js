// Optional modules only receive this public contract. No sibling-module imports.
export class ModuleRegistry {
  constructor(){this.items=new Map();this.errors=[];}
  async load(paths){await Promise.allSettled(paths.map(async path=>{try{const m=await import(new URL('../'+path.replace(/^\.\//,''),import.meta.url));const d=m.default;if(!d?.id||!d.label)throw Error('잘못된 블록 정의');this.items.set(d.id,d);}catch(e){this.errors.push({path,message:e.message});}}));}
  get(id){return this.items.get(id);}
  fields(id){try{return this.get(id)?.fields||[];}catch{return [];}}
  list(){return [...this.items.values()];}
}
