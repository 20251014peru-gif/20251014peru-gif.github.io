// A temporary panel: hover on a pointer device, click on touch, focus with a keyboard.
export function bindDayFlow(root){
 const button=root.querySelector('.flow-trigger'),panel=root.querySelector('.flow-panel');let hover=false;
 const set=open=>{if(open){const space=innerHeight-panel.getBoundingClientRect().top-(innerWidth<=760?88:24);panel.querySelector('.right-rail').style.maxHeight=Math.max(160,Math.min(640,space))+'px';}root.classList.toggle('open',open);button.setAttribute('aria-expanded',String(open));panel.inert=!open;};
 root.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){hover=true;set(true);}});
 root.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){hover=false;set(false);}});
 button.onclick=e=>set(hover&&e.detail>0?true:!root.classList.contains('open'));
 root.addEventListener('focusin',e=>{if(e.target!==button)set(true);});
 root.addEventListener('focusout',e=>{if(!root.contains(e.relatedTarget)&&!hover)set(false);});
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();set(false);button.focus();}});
 root.ownerDocument.addEventListener('pointerdown',function outside(e){if(!root.isConnected){root.ownerDocument.removeEventListener('pointerdown',outside);return;}if(!root.contains(e.target))set(false);});
 set(false);
}

