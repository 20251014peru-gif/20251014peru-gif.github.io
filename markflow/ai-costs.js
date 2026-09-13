/* Standard direct API rates, USD / million tokens. Verified 2026-09-14.
   https://platform.claude.com/docs/en/about-claude/pricing */
window.markflowCosts=(()=>{
  const rates={'claude-haiku-4-5':[1,5],'claude-sonnet-5':[2,10],'claude-opus-5':[5,25]},prefix='markflow_ai_cost_v1:',pending=new Map();let storageFailed=false;
  const money=n=>n>0&&n<0.0001?'<$0.0001':'$'+n.toFixed(4);
  function entries(){const all=new Map(pending);try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(prefix)){try{const e=JSON.parse(localStorage.getItem(k));if(e&&Number.isFinite(e.time))all.set(k,e);}catch{}}}}catch{storageFailed=true;}return [...all.values()].sort((a,b)=>a.time-b.time);}
  function render(){const es=entries(),total=es.reduce((n,e)=>n+(e.usd||0),0),last=es.at(-1),unknown=es.filter(e=>e.usd===null).length;
    document.querySelectorAll('.mf-cost-total').forEach(el=>el.textContent=money(total)+(unknown?' + 미집계':''));
    document.querySelectorAll('.mf-cost-detail').forEach(el=>el.textContent='이번 사용 '+(last?(last.usd===null?'확인 불가':money(last.usd)):'—')+' · 누적 '+money(total)+' · '+es.length+'회'+(unknown?' (미집계 '+unknown+'회)':'')+(storageFailed?' · 비용 기록 저장 실패: 현재 창에만 표시':''));
    const b=document.getElementById('btn-ai');if(b)b.title='AI · 이 브라우저 누적 예상 비용 '+money(total)+(unknown?' (미집계 있음)':'');
  }
  function record(j,requested){try{const model=j.model||requested,base=Object.keys(rates).find(m=>model===m||model.startsWith(m+'-')),r=rates[base],u=j.usage;
    const valid=n=>Number.isFinite(n)&&n>=0;
    let usd=null;if(r&&u&&valid(u.input_tokens)&&valid(u.output_tokens)){
      const read=u.cache_read_input_tokens||0,write=u.cache_creation_input_tokens||0,hour=u.cache_creation?.ephemeral_1h_input_tokens||0;
      if([read,write,hour].every(valid)&&hour<=write)usd=(u.input_tokens*r[0]+u.output_tokens*r[1]+read*r[0]*.1+(write-hour)*r[0]*1.25+hour*r[0]*2)/1e6;
    }
    const key=prefix+(j.id||crypto.randomUUID()),e={time:Date.now(),model,usd,input:u?.input_tokens??null,output:u?.output_tokens??null,rateDate:'2026-09-14'};
    // Separate response keys prevent parallel tabs from overwriting each other's totals.
    let exists=false;try{exists=!!localStorage.getItem(key);}catch{storageFailed=true;}if(!pending.has(key)&&!exists){pending.set(key,e);try{localStorage.setItem(key,JSON.stringify(e));pending.delete(key);}catch{storageFailed=true;}}
    render();
  }catch{storageFailed=true;render();}}
  function mount(){const b=document.getElementById('btn-ai');b.classList.add('mf-ai-cost-button');const badge=document.createElement('small');badge.className='mf-cost-total';badge.setAttribute('aria-label','AI 누적 예상 비용');b.append(badge);
    for(const host of [document.getElementById('ai-menu'),document.querySelector('#ai-modal .modal-b')]){const box=document.createElement('div');box.className='mf-cost-box';box.innerHTML='<strong>AI 예상 비용 · USD</strong><div class="mf-cost-detail" aria-live="polite"></div><small>이 업데이트 이후, 이 브라우저에서 확인된 사용량만 합산합니다. 다른 기기·과거 사용·세금은 제외됩니다. 통신이 끊긴 요청은 누락될 수 있습니다.</small><a href="https://platform.claude.com/docs/en/about-claude/pricing" target="_blank" rel="noopener">공식 요금표 · 2026-09-14 기준</a>';host.append(box);}
    render();window.addEventListener('storage',render);
  }
  return {record,mount};
})();
