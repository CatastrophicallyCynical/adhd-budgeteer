/* Minimal Budgeteer home logic (localStorage-only) */
const LS = {
  meta: 'budgeteer_meta',
  expenses: 'budgeteer_expenses',
  income: 'budgeteer_income'
};

const DEFAULT_BUCKETS = [
  { id:'bills',     name:'Bills',     emoji:'💡', target:0 },
  { id:'groceries', name:'Groceries', emoji:'🍎', target:0 },
  { id:'eatingout', name:'Eating Out',emoji:'🍔', target:0 },
  { id:'transport', name:'Transport', emoji:'🚌', target:0 },
  { id:'fun',       name:'Fun',       emoji:'🎮', target:0 },
  { id:'health',    name:'Health',    emoji:'🏥', target:0 },
  { id:'kids',      name:'Kids',      emoji:'👶', target:0 },
  { id:'other',     name:'Other',     emoji:'📦', target:0 },
  { id:'savings',   name:'Savings',   emoji:'🪙', target:0 },
];

function load(key, def){ try{ return JSON.parse(localStorage.getItem(key)) ?? def; }catch{ return def; } }
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

function ensureMeta(){
  const meta = load(LS.meta, { theme:'blue', version:1 });
  if (!meta.theme) meta.theme = 'blue';
  save(LS.meta, meta);
  document.body.setAttribute('data-theme', meta.theme);
  return meta;
}

function ensureBuckets(){
  const have = load('budgeteer_buckets', null);
  if (!have){ save('budgeteer_buckets', DEFAULT_BUCKETS); return DEFAULT_BUCKETS; }
  return have;
}

function monthRange(Y,M){
  return [new Date(Y,M,1).getTime(), new Date(Y,M+1,1).getTime()];
}
function monthTitle(Y,M){
  return new Date(Y,M,1).toLocaleString(undefined,{month:'long',year:'numeric'});
}

let CUR_Y = new Date().getFullYear();
let CUR_M = new Date().getMonth();

function render(){
  ensureMeta();
  const buckets = ensureBuckets();
  const expenses = load(LS.expenses, []); // [{id, amount(-), bucketId, note, date(YYYY-MM-DD)}]
  const [start,end] = monthRange(CUR_Y, CUR_M);
  const monthExp = expenses.filter(e => {
    const ts = new Date(e.date+'T12:00').getTime();
    return ts>=start && ts<end;
  });

  document.getElementById('monthTitle').textContent = monthTitle(CUR_Y, CUR_M);

  const byBucket = Object.fromEntries(buckets.map(b=>[b.id, []]));
  monthExp.forEach(e => { if (!byBucket[e.bucketId]) byBucket[e.bucketId]=[]; byBucket[e.bucketId].push(e); });

  const list = document.getElementById('bucketList');
  list.innerHTML = '';

  for(const b of buckets){
    const items = byBucket[b.id] || [];
    const total = items.reduce((s,e)=> s + Number(e.amount||0), 0); // amounts should be negative for expenses
    const card = document.createElement('div');
    card.className = 'bucket';
    card.innerHTML = `
      <div class="row" style="align-items:center">
        <div class="name"><span class="emoji">${b.emoji}</span> ${b.name}</div>
        <div class="row" style="gap:8px">
          <a class="btn" href="expense.html?bucket=${encodeURIComponent(b.id)}">＋</a>
          <button class="btn" data-expand="${b.id}">▾</button>
        </div>
      </div>
      <div class="small">This month: <b>${(total).toFixed(2)}</b></div>
      <div class="bar"><div style="width:${Math.min(100, Math.abs(total))}%;"></div></div>
      <div class="details" id="d-${b.id}" style="display:none; margin-top:8px">
        ${items.length ? items.map(e=>`
          <div class="row small">
            <div>${e.date} • ${(e.note||'—').replace(/</g,'&lt;')}</div>
            <div style="display:flex; gap:6px; align-items:center">
              <span>${Number(e.amount).toFixed(2)}</span>
              <button class="btn" data-edit="${e.id}">Edit</button>
              <button class="btn" data-del="${e.id}">Delete</button>
            </div>
          </div>`).join('') : `<div class="small">No items in ${monthTitle(CUR_Y,CUR_M)}.</div>`}
      </div>
    `;
    list.appendChild(card);
  }

  // expand handlers
  list.querySelectorAll('[data-expand]').forEach(btn=>{
    btn.onclick = ()=> {
      const id = btn.getAttribute('data-expand');
      const el = document.getElementById('d-'+id);
      el.style.display = (el.style.display==='none'||!el.style.display) ? 'block' : 'none';
    };
  });

  // edit/delete
  list.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.getAttribute('data-edit');
      const all = load(LS.expenses, []);
      const e = all.find(x=>x.id===id); if(!e) return;
      const amt = Number(prompt('Amount (negative for expense)', e.amount));
      if (Number.isNaN(amt)) return;
      const note = prompt('Note', e.note||'') || '';
      const date = prompt('Date (YYYY-MM-DD)', e.date) || e.date;
      e.amount = amt; e.note = note; e.date = date;
      save(LS.expenses, all);
      render();
    };
  });
  list.querySelectorAll('[data-del]').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.getAttribute('data-del');
      const all = load(LS.expenses, []);
      const next = all.filter(x=>x.id!==id);
      save(LS.expenses, next);
      render();
    };
  });
}

document.getElementById('prev').onclick = ()=>{ if(--CUR_M<0){CUR_M=11;CUR_Y--;} render(); };
document.getElementById('next').onclick = ()=>{ if(++CUR_M>11){CUR_M=0;CUR_Y++;} render(); };

(function init(){ render(); })();
// ===== Spendable summary (Income - Expenses excluding Savings) =====
(function(){
  const LS_INC = 'budgeteer_income';
  const LS_EXP = 'budgeteer_expenses';
  const SAVINGS_IDS = new Set(['savings']); // update if you use a different id

  const fmt = n => (Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const load = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };

  function parseMonthFromTitle(){
    // Expecting something like "August 2025"
    const el = document.getElementById('monthTitle');
    if (!el) return { y:new Date().getFullYear(), m:new Date().getMonth() };
    const txt = (el.textContent || '').trim();
    const d = new Date(txt+' 1'); // "August 2025 1" -> first of that month
    if (isNaN(d.getTime())) return { y:new Date().getFullYear(), m:new Date().getMonth() };
    return { y: d.getFullYear(), m: d.getMonth() };
  }

  function monthRange(y,m){
    const start = new Date(y, m, 1).getTime();
    const end   = new Date(y, m+1, 1).getTime();
    return [start, end];
  }

  function renderSpendable(){
    const out = document.getElementById('spendableAmount');
    if (!out) return;

    const { y, m } = parseMonthFromTitle();
    const [s,e] = monthRange(y,m);

    const inc = load(LS_INC, []);
    const exp = load(LS_EXP, []);

    const monthInc = inc.filter(x=>{
      const ts = new Date((x.date||'') + 'T12:00').getTime();
      return ts>=s && ts<e;
    });

    const monthExp = exp.filter(x=>{
      const ts = new Date((x.date||'') + 'T12:00').getTime();
      return ts>=s && ts<e;
    });

    const incomeTotal = monthInc.reduce((sum,x)=> sum + (Number(x.amount)||0), 0);

    // Expenses: exclude savings buckets; treat amounts as magnitude of spend
    const spendNonSavings = monthExp
      .filter(x => !SAVINGS_IDS.has(x.bucketId))
      .reduce((sum,x)=>{
        const a = Number(x.amount)||0;
        return sum + (a<0 ? -a : Math.abs(a));
      }, 0);

    const spendable = incomeTotal - spendNonSavings;

    out.innerHTML = `
      <b>Spendable:</b> $${fmt(spendable)}
      &nbsp;•&nbsp; <span class="small">Income: $${fmt(incomeTotal)}</span>
      &nbsp;•&nbsp; <span class="small">Expenses (excl. Savings): $${fmt(spendNonSavings)}</span>
    `;
  }

  // Recompute on load, when the month title changes, and when page regains focus
  document.addEventListener('DOMContentLoaded', renderSpendable);
  window.addEventListener('focus', renderSpendable);

  const titleEl = document.getElementById('monthTitle');
  if (titleEl && 'MutationObserver' in window){
    new MutationObserver(renderSpendable).observe(titleEl, { childList:true, characterData:true, subtree:true });
  }

  // Optional: expose for other code to call after edits
  window.Budgeteer_refreshSummary = renderSpendable;
})();
