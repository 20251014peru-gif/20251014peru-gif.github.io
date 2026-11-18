/* Never rewrite the editable tree, move its caret, or publish partial IME syllables. */
(()=>{'use strict';const targets=new Set(),explicit=new Set();let settleAt=0,timer=0;const editing=n=>n instanceof Element&&!!n.closest('input,textarea,[contenteditable=true]');const unsettled=()=>targets.size>0||Date.now()<settleAt;
function finish(){clearTimeout(timer);timer=setTimeout(()=>{if(unsettled()){finish();return}window.dispatchEvent(new Event('qm-input-settled'));if(typeof active!=='undefined'&&active&&document.getElementById('modalbg').classList.contains('show'))scheduleSave()},100)}
document.addEventListener('compositionstart',e=>{if(!editing(e.target))return;targets.add(e.target);explicit.add(e.target);clearTimeout(timer);if(typeof saveTimer!=='undefined')clearTimeout(saveTimer)},true);
document.addEventListener('compositionend',e=>{targets.delete(e.target);explicit.delete(e.target);settleAt=Date.now()+90;finish()},true);
document.addEventListener('input',e=>{if(!editing(e.target))return;if(e.isComposing){targets.add(e.target);if(typeof saveTimer!=='undefined')clearTimeout(saveTimer)}else if(targets.has(e.target)&&!explicit.has(e.target)){targets.delete(e.target);settleAt=Date.now()+90;finish()}},true);
document.addEventListener('focusout',e=>{if(!targets.has(e.target))return;setTimeout(()=>{if(document.activeElement!==e.target){targets.delete(e.target);explicit.delete(e.target);settleAt=Date.now()+90;finish()}},50)},true);
window.QMInput={get isComposing(){return unsettled()},async settled(){while(unsettled())await new Promise(r=>setTimeout(r,30))}};
// A toolbar press must first commit an in-progress syllable. The replay uses the
// existing button handler only after composition and the final input have settled.
document.addEventListener('click',e=>{const b=e.target.closest('.longtools button');if(!b||!unsettled())return;e.preventDefault();e.stopImmediatePropagation();document.activeElement?.blur();QMInput.settled().then(()=>{if(b.isConnected&&document.getElementById('modalbg').classList.contains('show'))b.click()})},true);
function initialize(){const prior=render;render=function(){if(active&&$('modalbg').classList.contains('show'))return;return prior()}}
if(window.QMAppReady)initialize();else window.addEventListener('qm-ready',initialize,{once:true});
})();
