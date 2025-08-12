// notify.js — local daily/weekly nudges + recurring YES/NO confirms (no backend)
(function(){
  const LS_SETTINGS = 'budgeteer_nudge';
  const LS_EXP = 'budgeteer_expenses';
  const LS_INC = 'budgeteer_income';
  const LS_REC = 'budgeteer_recurring';

  function load(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } }
  function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  // defaults
  const defaults = {
    daily:   { enabled:true,  time:'10:00', last:'' },
    weekly:  { sun:{enabled:true,time:'12:00', last:''}, mid:{enabled:true,time:'10:00', last:''} },
    confirm: { enabled:true }
  };
  const state = Object.assign({}, defaults, load(LS_SETTINGS, {}));
  // merge nested
  state.daily   = Object.assign({}, defaults.daily, state.daily||{});
  state.weekly  = { sun: Object.assign({}, defaults.weekly.sun, (state.weekly||{}).sun||{}),
                    mid: Object.assign({}, defaults.weekly.mid, (state.weekly||{}).mid||{}) };
  state.confirm = Object.assign({}, defaults.confirm, state.confirm||{});
  save(LS_SETTINGS, state);

  // permission helper
  async function ensurePermission(){
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied')  return false;
    try { return (await Notification.requestPermission()) === 'granted'; }
    catch { return false; }
  }

  function hhmm(date){ return String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0'); }
  function todayISO(){ return new Date().toISOString().slice(0,10); }

  function bumpMonthly(date){ const d=new Date(date); d.setMonth(d.getMonth()+1); return d; }
  function bumpWeekly(date, weeks){ const d=new Date(date); d.setDate(d.getDate()+7*(weeks||1)); return d; }
  function lastDayOfMonth(y,m){ return new Date(y, m+1, 0).getDate(); }

  // post a local notification (best-effort)
  async function post(title, body, tag){
    const ok = await ensurePermission();
    if (!ok) return false;
    try { new Notification(title, { body, tag }); return true; } catch { return false; }
  }

  // YES/NO confirm (modal) for recurring item
  function confirmRecurring(r){
    const yes = confirm(`Did "${r.name||'Recurring'}" ${r.type==='inc'?'arrive':'come out'} today?\n\nBucket: ${r.bucketId||'—'} • Amount: ${r.amount}`);
    if (yes){
      const date = todayISO();
      if (r.type === 'inc'){
        const all = load(LS_INC, []);
        all.push({ id: crypto.randomUUID?.()||String(Date.now()), amount: +Math.abs(r.amount), date, note:`recurring: ${r.name}` });
        save(LS_INC, all);
      } else {
        const all = load(LS_EXP, []);
        all.push({ id: crypto.randomUUID?.()||String(Date.now()), amount: -Math.abs(r.amount), bucketId: r.bucketId||'', date, note:`recurring: ${r.name}` });
        save(LS_EXP, all);
      }
      advanceRecurring(r);
    } else {
      // small snooze: ask minutes or days
      const pick = prompt('Snooze for how many days? (enter number)\nCancel = leave as-is', '1');
      if (pick && !isNaN(+pick)){
        const dd = +pick;
        const next = new Date(r.nextDueISO || new Date());
        next.setDate(next.getDate()+dd);
        r.nextDueISO = next.toISOString();
        writeRecurring(r);
        alert(`Snoozed ${dd} day(s)`);
      }
    }
  }

  function advanceRecurring(r){
    const base = new Date(r.nextDueISO || new Date());
    let next = base;
    const cad = (r.cadence||'monthly');
    if (cad==='weekly') next = bumpWeekly(base, 1);
    else if (cad==='biweekly') next = bumpWeekly(base, 2);
    else if (cad==='monthly') next = bumpMonthly(base);
    else if (cad==='lastday') {
      const d = new Date(base); d.setMonth(d.getMonth()+1, 1); // move to next month, day 1
      d.setDate(lastDayOfMonth(d.getFullYear(), d.getMonth()));
      next = d;
    } else next = bumpMonthly(base);
    r.nextDueISO = next.toISOString();
    writeRecurring(r);
  }

  function writeRecurring(r){
    const all = load(LS_REC, []);
    const i = all.findIndex(x=>x.id===r.id);
    if (i>=0) all[i]=r; else all.push(r);
    save(LS_REC, all);
  }

  // scanning tick
  async function tick(){
    const now = new Date();
    const time = hhmm(now);
    const today = todayISO();

    // daily nudge
    if (state.daily.enabled && state.daily.time===time && state.daily.last!==today){
      const fired = await post('2-min money check?', 'Log anything new and tap a bucket.', 'budgeteer-daily');
      state.daily.last = today;
      save(LS_SETTINGS, state);
      if (!fired) { /* noop */ }
    }

    // weekly: Sunday reset (weekday 0), midweek (Wednesday 3 by default)
    const w = now.getDay(); // 0 Sun .. 6 Sat

    if (state.weekly.sun.enabled && w===0 && state.weekly.sun.time===time && state.weekly.sun.last!==today){
      await post('Sunday reset', 'Peek at upcoming bills + targets for the week.', 'budgeteer-weekly-sun');
      state.weekly.sun.last = today; save(LS_SETTINGS, state);
    }

    if (state.weekly.mid.enabled && w===3 && state.weekly.mid.time===time && state.weekly.mid.last!==today){
      await post('Mid-week check-in', 'Halfway mark—any new expenses to log?', 'budgeteer-weekly-mid');
      state.weekly.mid.last = today; save(LS_SETTINGS, state);
    }

    // recurring confirmations
    if (state.confirm.enabled){
      const rec = load(LS_REC, []);
      for (const r of rec){
        if (!r.nextDueISO) continue;
        const due = new Date(r.nextDueISO);
        // trigger when the clock exactly matches the due minute
        if (Math.abs(now - due) < 60000){ // within 60s window
          // Notify & prompt
          await post(`${r.name||'Recurring'} due`, 'Tap to confirm inside the app.', 'budgeteer-recurring-'+r.id);
          confirmRecurring(r);
        }
      }
    }
  }

  setInterval(tick, 60*1000);
  setTimeout(tick, 5000);

  // expose minimal API for About UI
  window.__budgeteerNotify = {
    get(){ return load(LS_SETTINGS, defaults); },
    set(patch){
      const cur = load(LS_SETTINGS, defaults);
      // shallow merge top + known children
      if ('daily' in patch)  cur.daily  = Object.assign({}, cur.daily, patch.daily);
      if ('weekly' in patch){
        cur.weekly = cur.weekly || {};
        if (patch.weekly.sun) cur.weekly.sun = Object.assign({}, cur.weekly.sun, patch.weekly.sun);
        if (patch.weekly.mid) cur.weekly.mid = Object.assign({}, cur.weekly.mid, patch.weekly.mid);
      }
      if ('confirm' in patch) cur.confirm = Object.assign({}, cur.confirm, patch.confirm);
      save(LS_SETTINGS, cur);
      return cur;
    },
    test(type){
      if (type==='daily') post('2-min money check?', 'Log anything new and tap a bucket.', 'test-daily');
      if (type==='sun')   post('Sunday reset', 'Peek at upcoming bills + targets for the week.', 'test-sun');
      if (type==='mid')   post('Mid-week check-in', 'Halfway mark—any new expenses to log?', 'test-mid');
    }
  };
})();
