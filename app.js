import { idb } from './db.js';
import { ensurePushPermission, listenForegroundMessages } from './firebase.js';

const DEFAULT_SETTINGS = {
  tz: 'America/Detroit',
  weeklyResetDay: 0,
  midWeekDay: 3,
  dailyNudgeEnabled: true,
  dailyNudgeTime: '10:00',
  affirmationsInApp: true,
  affirmationsInPush: true,
  themePreset: 'breeze',
  themeCustom: { bg:null, panel:null, ink:null }, // set on About page
  version: null,
};

const COLORS = [
  {name:'Sky',      hex:'#4FC3F7'},
  {name:'Grass',    hex:'#81C784'},
  {name:'Lemon',    hex:'#FFD54F'},
  {name:'Coral',    hex:'#FF8A65'},
  {name:'Lavender', hex:'#BA68C8'},
  {name:'Mint',     hex:'#4DB6AC'},
  {name:'Sand',     hex:'#FBC02D'},
  {name:'Slate',    hex:'#90A4AE'},
  {name:'Rose',     hex:'#F48FB1'},
  {name:'Navy',     hex:'#3949AB'},
];

const DEFAULT_BUCKETS = [
  { id:'groceries', name:'Groceries', emoji:'🍎', color:'Sky',      target:0, rollover:true,  info:'Food you buy to make at home. Supermarket runs, farmer’s markets, snacks to eat later. Not takeout.' },
  { id:'eatingout', name:'Eating Out',emoji:'🍔', color:'Coral',    target:0, rollover:false, info:'Meals ready to eat now. Restaurants, takeout, coffee shops, food trucks.' },
  { id:'transport', name:'Transport', emoji:'🚌', color:'Grass',    target:0, rollover:true,  info:'Getting from point A to B. Gas, fares, rideshares, tolls, parking, repairs.' },
  { id:'bills',     name:'Bills',     emoji:'💡', color:'Slate',    target:0, rollover:false, info:'Regular payments. Rent/mortgage, utilities, phone/internet, insurance, subscriptions.' },
  { id:'fun',       name:'Fun',       emoji:'🎮', color:'Lemon',    target:0, rollover:true,  info:'Things you do just because. Games, hobbies, movies, music, trips, treats.' },
  { id:'other',     name:'Other',     emoji:'📦', color:'Sand',     target:0, rollover:true,  info:'Doesn’t fit elsewhere. One-off purchases, surprises, gifts.' },
  { id:'savings',   name:'Savings',   emoji:'🪙', color:'Mint',     target:0, rollover:true,  info:'Money Future-You will thank you for. Emergency fund, planned big purchases, extra debt payments.' },
  { id:'health',    name:'Health',    emoji:'🏥', color:'Lavender', target:0, rollover:true,  info:'Taking care of body and mind. Doctor, prescriptions, therapy, OTC meds, gym.' },
  { id:'kids',      name:'Kids',      emoji:'👶', color:'Rose',     target:0, rollover:true,  info:'Little humans: clothes, toys, school supplies, childcare, activities.' },
];

let AFFIRMATIONS = [];
let meta = null;
let CURRENT_YEAR = new Date().getFullYear();
let CURRENT_MONTH = new Date().getMonth(); // 0..11

// ---------- helpers ----------
async function loadMeta(){
  const [m, a] = await Promise.all([
    fetch('./appMeta.json').then(r=>r.json()),
    fetch('./affirmations.json').then(r=>r.json())
  ]);
  meta = m; AFFIRMATIONS = a;
}

function colorHexByName(name){ return (COLORS.find(c=>c.name===name)||COLORS[0]).hex; }
function monthRange(year, month){ return [new Date(year,month,1).getTime(), new Date(year,month+1,1).getTime()]; }
function money(n){ return (n>=0?'+':'') + n.toFixed(2); }
function titleMonth(year, month){ return new Date(year,month,1).toLocaleString(undefined,{month:'long',year:'numeric'}); }

function toast(msg){
  const t=document.querySelector('.toast'); t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}

// ---------- theme apply ----------
async function applyTheme(){
  await idb.open();
  const s = (await idb.get('settings','app')) || DEFAULT_SETTINGS;
  const t = s.themeCustom || {};
  if (t.bg)   document.documentElement.style.setProperty('--bg', t.bg);
  if (t.panel)document.documentElement.style.setProperty('--panel', t.panel);
  if (t.ink)  document.documentElement.style.setProperty('--ink', t.ink);
}

// ---------- boot ----------
async function ensureDefaults(){
  await idb.open();
  let settings = await idb.get('settings','app');
  if(!settings){
    settings = {...DEFAULT_SETTINGS, version: meta?.version || '0.1.0' };
    await idb.set('settings','app', settings);
  }
  let buckets = await idb.all('buckets');
  if(!buckets || !buckets.length){
    await Promise.all(DEFAULT_BUCKETS.map(b=>idb.put('buckets', b)));
  }
}

function renderAffirmation(){
  if(!AFFIRMATIONS.length) return;
  const el = document.querySelector('.affirmation');
  const seen = JSON.parse(localStorage.getItem('affirm_seen') || '[]');
  let idx = AFFIRMATIONS.findIndex((_,i)=>!seen.includes(i));
  if (idx === -1) { localStorage.setItem('affirm_seen','[]'); idx = 0; }
  el.textContent = AFFIRMATIONS[idx];
  seen.push(idx); localStorage.setItem('affirm_seen', JSON.stringify(seen));
}

// ---------- main render ----------
async function render(){
  const app = document.querySelector('#app');
  const buckets = await idb.all('buckets');
  const txs = await idb.all('transactions');

  // month filter
  const [start, end] = monthRange(CURRENT_YEAR, CURRENT_MONTH);
  const monthTxs = txs.filter(t => t.ts >= start && t.ts < end);

  // totals per bucket for this month
  const totals = Object.fromEntries(buckets.map(b=>[b.id,0]));
  for(const t of monthTxs){
    totals[t.bucketId || ''] = (totals[t.bucketId || '']||0) + t.amount;
  }

  app.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between; align-items:center">
        <div>
          <div class="app-title">Gentle Budget</div>
          <div class="affirmation"></div>
        </div>
        <div class="row" style="gap:6px">
          <button class="btn" id="prevMonth">◀</button>
          <div class="kbd">${titleMonth(CURRENT_YEAR, CURRENT_MONTH)}</div>
          <button class="btn" id="nextMonth">▶</button>
        </div>
      </div>
      <div class="actions">
        <button class="btn primary" id="addExpense">Add Expense</button>
        <button class="btn" id="addIncome">Add Income</button>
        <a class="btn" href="recurring.html">Recurring</a>
        <a class="btn" href="about.html">About</a>
      </div>
    </div>

    <div class="card">
      <div class="row"><div style="font-weight:700">Buckets</div>
        <div class="small">Tap ⓘ to see what counts • Tap ▾ to view entries</div>
      </div>
      <div class="grid buckets" style="margin-bottom:72px">
        ${buckets.map(b=>{
          const color = colorHexByName(b.color);
          const monthTotal = totals[b.id] || 0;
          const spent = Math.max(0, -monthTotal);
          const pct = b.target>0 ? Math.min(100, Math.max(0, Math.round((spent/b.target)*100))) : 0;

          const items = monthTxs.filter(t => (t.bucketId||'') === b.id);
          const list = items.map(t=>{
            const dt = new Date(t.ts).toLocaleDateString();
            const note = (t.note||'—').replace(/</g,'&lt;');
            return `
            <div class="row small">
              <div>${dt} • ${note}</div>
              <div style="display:flex; gap:6px; align-items:center">
                <span>${money(t.amount)}</span>
                <button class="btn" data-edit="${t.id}">Edit</button>
                <button class="btn" data-del="${t.id}">Delete</button>
              </div>
            </div>`;
          }).join('');

          return `
          <div class="bucket" data-id="${b.id}">
            <div class="row" style="align-items:center">
              <div class="name"><span class="emoji">${b.emoji}</span> ${b.name}</div>
              <div class="row" style="gap:8px">
                <button class="btn" data-target="${b.id}">🎯 Target</button>
                <button class="btn" data-info="${b.id}">ⓘ</button>
                <button class="btn" data-expand="${b.id}">▾</button>
              </div>
            </div>
            <div class="small meta">This month: <b>${money(monthTotal)}</b>${b.target>0 ? ` • Target ${b.target.toFixed(2)}`:''}</div>
            <div class="bar"><div style="width:${pct}%; background:${color}"></div></div>
            <div class="info">${b.info}</div>
            <div class="details" id="details-${b.id}" style="display:none; margin-top:8px">
              ${items.length ? list : `<div class="small">No items in ${titleMonth(CURRENT_YEAR, CURRENT_MONTH)}.</div>`}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="row"><div style="font-weight:700">Reminders</div></div>
      <div class="grid" style="grid-template-columns: 1fr 1fr">
        <div>
          <label>Daily nudge</label>
          <div class="row">
            <input type="time" id="dailyTime" value="10:00">
            <button class="btn" id="saveDaily">Save</button>
          </div>
          <div class="small">“2-min money check?” at your chosen time.</div>
        </div>
        <div>
          <label>Push permissions</label>
          <div class="row">
            <button class="btn" id="enablePush">Enable notifications</button>
          </div>
          <div class="small">Works when installed to Home Screen on iOS.</div>
        </div>
      </div>
    </div>

    <div class="toast" role="status" aria-live="polite"></div>
  `;

  renderAffirmation();

  // month nav
  document.getElementById('prevMonth').onclick = ()=>{ CURRENT_MONTH--; if (CURRENT_MONTH<0){ CURRENT_MONTH=11; CURRENT_YEAR--; } render(); };
  document.getElementById('nextMonth').onclick = ()=>{ CURRENT_MONTH++; if (CURRENT_MONTH>11){ CURRENT_MONTH=0; CURRENT_YEAR++; } render(); };

  // info + expand
  document.querySelectorAll('[data-info]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const id = e.currentTarget.getAttribute('data-info');
      document.querySelector(`.bucket[data-id="${id}"]`).classList.toggle('open');
    });
  });
  document.querySelectorAll('[data-expand]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const id = e.currentTarget.getAttribute('data-expand');
      const d = document.getElementById(`details-${id}`);
      d.style.display = (d.style.display==='none' || !d.style.display) ? 'block' : 'none';
    });
  });

  // edit/delete transactions
  document.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', async (e)=>{
      const id = e.currentTarget.getAttribute('data-edit');
      const all = await idb.all('transactions');
      const t = all.find(x=>x.id===id); if(!t) return;
      const amt = Number(prompt('Amount', t.amount));
      if (isNaN(amt)) return;
      const note = prompt('Note', t.note||'') || '';
      const when = prompt('Date (YYYY-MM-DD)', new Date(t.ts).toISOString().slice(0,10));
      let ts = t.ts;
      if (when){
        const [Y,M,D] = when.split('-').map(Number);
        ts = new Date(Y, M-1, D, 12, 0).getTime();
      }
      const updated = { ...t, amount: amt, note, ts };
      await idb.put('transactions', updated);
      toast('Updated'); render();
    });
  });
  document.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const id = e.currentTarget.getAttribute('data-del');
      const req = indexedDB.open('gentle-budget');
      req.onsuccess = ()=> {
        const d=req.result;
        const t=d.transaction('transactions','readwrite').objectStore('transactions').delete(id);
        t.onsuccess = ()=> { toast('Deleted'); render(); };
      };
    });
  });

  // set target per bucket
  document.querySelectorAll('[data-target]').forEach(btn=>{
    btn.addEventListener('click', async (e)=>{
      const id = e.currentTarget.getAttribute('data-target');
      const list = await idb.all('buckets');
      const b = list.find(x=>x.id===id);
      const v = prompt(`Monthly target for ${b.name}`, b.target||0);
      if (v===null) return;
      const n = Number(v)||0;
      b.target = n;
      await idb.put('buckets', b);
      toast('Target saved'); render();
    });
  });

  // actions
  document.getElementById('addExpense').onclick = ()=> window.open('expense.html','_blank');
  document.getElementById('addIncome').onclick  = ()=> window.open('income.html','_blank');

  document.getElementById('enablePush').onclick = async ()=>{
    const res = await ensurePushPermission();
    toast(res.ok ? 'Notifications enabled' : 'Could not enable');
  };
  document.getElementById('saveDaily').onclick = async ()=>{
    const t = document.getElementById('dailyTime').value || '10:00';
    const s = await idb.get('settings','app'); s.dailyNudgeEnabled = true; s.dailyNudgeTime = t; await idb.set('settings','app', s);
    toast('Daily nudge saved');
  };
}

(async function init(){
  await loadMeta();
  await ensureDefaults();
  await applyTheme();
  await render();
  listenForegroundMessages();
})();
