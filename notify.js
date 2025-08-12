// notify.js — zero-backend daily nudge
(function(){
  const KEY = 'budgeteer_nudge';
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }catch{ return {}; } }
  function save(v){ localStorage.setItem(KEY, JSON.stringify(v)); }

  // default settings if none saved
  const s = load();
  if (!('enabled' in s)) s.enabled = true;
  if (!s.time) s.time = '10:00'; // default 10 AM
  if (!s.last) s.last = '';      // YYYY-MM-DD guard
  save(s);

  // ask permission once, lazily
  async function ensurePermission(){
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try{ const res = await Notification.requestPermission(); return res === 'granted'; }catch{ return false; }
  }

  // check every minute; fire once per day
  async function tick(){
    const cfg = load();
    if (!cfg.enabled) return;

    const ok = await ensurePermission();
    if (!ok) return;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const today = now.toISOString().slice(0,10);

    if (cfg.last === today) return; // already sent today
    if ((hh+':'+mm) !== cfg.time) return;

    // fire
    try{
      new Notification('2-min money check?', { body: 'Log anything new and tap a bucket.', tag: 'budgeteer-daily' });
      cfg.last = today; save(cfg);
    }catch(_){}
  }

  setInterval(tick, 60*1000);
  // also run once ~10s after load (in case you open right at the time)
  setTimeout(tick, 10*1000);

  // expose tiny API for About page
  window.__budgeteerNudge = {
    get: load,
    set: (v)=> save(Object.assign(load(), v))
  };
})();
