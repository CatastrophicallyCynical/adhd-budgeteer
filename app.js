import { idb } from './db.js';
import { ensurePushPermission, listenForegroundMessages } from './firebase.js';

const DEFAULT_SETTINGS = {
  tz: 'America/Detroit',
  weeklyResetDay: 0,      // Sunday
  midWeekDay: 3,          // Wednesday
  dailyNudgeEnabled: true,
  dailyNudgeTime: '10:00',
  affirmationsInApp: true,
  affirmationsInPush: true,
  themePreset: 'breeze',
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

async function loadMeta(){
  const [m, a] = await Promise.all([
    fetch('./appMeta.json').then(r=>r.json()),
    fetch('./affirmations.json').then(r=>r.json())
  ]);
  meta = m; AFFIRMATIONS = a;
}

function pickTextColor(bgHex){
  // YIQ contrast
  const hex = bgHex.replace('#','');
  const r = parseInt(hex.substr(0,2),16);
  const g = parseInt(hex.substr(2,2),16);
  const b = parseInt(hex.substr(4,2),16);
  const yiq = ((r*299)+(g*587)+(b*114))/1000;
  return yiq >= 140 ? '#111827' : '#ffffff';
}
const colorHexByName = (name)=> (COLORS.find(c=>c.name===name)||COLORS[0]).hex;

function toast(msg){
  const t=document.querySelector('.toast'); t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}

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

async function render(){
  const app = document.querySelector('#app');
  const buckets = await idb.all('buckets');

  // totals for progress
  const txs = await idb.all('transactions');
  const byBucket = Object.fromEntries(buckets.map(b=>[b.id,0]));
  for(const t of txs){ byBucket[t.bucketId] = (byBucket[t.bucketId]||0) + t.amount; }

  const spendable = '—'; // placeholder until you add cycle math

  app.innerHTML = `
    <div class="card">
      <div class="row">
        <div>
          <div class="app-title">Gentle Budget</div>
          <div class="affirmation"></div>
        </div>
        <button class="btn" id="btnAbout">About</button>
      </div>
      <div class="big-number">Spendable: ${spendable}</div>
      <div class="actions">
        <button class="btn primary" id="addExpense">Add Expense</button>
        <button class="btn" id="addIncome">Add Income</button>
        <button class="btn" id="customize">Customize</button>
      </div>
    </div>

    <div class="card">
      <div class="row"><div style="font-weight:700">Buckets</div><div class="small">Tap ⓘ to see what counts</div></div>
      <div class="grid buckets">
        ${buckets.map(b=>{
          const color = colorHexByName(b.color);
          const text = pickTextColor(color);
          let spent = -(byBucket[b.id]||0); // expenses negative
          let pct = b.target>0 ? Math.min(100, Math.max(0, Math.round((spent/b.target)*100))) : 0;
          return `
          <div class="bucket" data-id="${b.id}">
            <div class="row">
              <div class="name"><span class="emoji">${b.emoji}</span> ${b.name}</div>
              <button class="btn" data-info="${b.id}">ⓘ</button>
            </div>
            <div class="bar"><div style="width:${pct}%; background:${color}"></div></div>
            <div class="info">${b.info}</div>
            <div class="row small"><span>Color:</span>
              <div class="chips">
                ${COLORS.map(c=>`
                  <span class="chip ${b.color===c.name?'active':''}" title="${c.name}" data-bucket="${b.id}" data-color="${c.name}">
                    <span class="color-dot" style="background:${c.hex}"></span>
                  </span>
                `).join('')}
              </div>
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

  // listeners
  document.querySelectorAll('[data-info]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const id = e.currentTarget.getAttribute('data-info');
      document.querySelector(`.bucket[data-id="${id}"]`).classList.toggle('open');
    });
  });

  document.querySelectorAll('.chip').forEach(ch=>{
    ch.addEventListener('click', async (e)=>{
      const id = e.currentTarget.getAttribute('data-bucket');
      const color = e.currentTarget.getAttribute('data-color');
      const list = await idb.all('buckets');
      const b = list.find(x=>x.id===id);
      b.color = color;
      await idb.put('buckets', b);
      toast('Updated color');
      render();
    });
  });

  document.getElementById('enablePush').addEventListener('click', async ()=>{
    const res = await ensurePushPermission();
    toast(res.ok ? 'Notifications enabled' : 'Could not enable');
  });

  document.getElementById('saveDaily').addEventListener('click', async ()=>{
    const t = document.getElementById('dailyTime').value || '10:00';
    const s = await idb.get('settings','app'); s.dailyNudgeEnabled = true; s.dailyNudgeTime = t; await idb.set('settings','app', s);
    toast('Daily nudge saved');
  });

  document.getElementById('btnAbout').addEventListener('click', ()=> window.open('about.html','_blank'));
  document.getElementById('addExpense').addEventListener('click', ()=> window.open('expense.html','_blank'));
  document.getElementById('addIncome').addEventListener('click', ()=> window.open('income.html','_blank'));

  // Recent activity card (last 5)
  const recent = [...txs].sort((a,b)=>b.ts-a.ts).slice(0,5);
  const card = document.createElement('div');
  card.className='card';
  card.innerHTML = `
    <div class="row"><div style="font-weight:700">Recent activity</div>
      <div class="small">${recent.length? 'Last 5' : 'No activity yet'}</div>
    </div>
    ${recent.map(t=>{
      const dt = new Date(t.ts).toLocaleString();
      const amt = (t.amount>=0?'+':'') + t.amount.toFixed(2);
      return `<div class="row"><div class="small">${dt}</div><div class="small">${amt}</div></div>`;
    }).join('')}
  `;
  document.querySelector('#app').appendChild(card);
}

(async function init(){
  await loadMeta();
  await ensureDefaults();
  await render();
  listenForegroundMessages();
})();
