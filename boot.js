// boot.js — diagnose startup issues, show which file is broken
import { applyTheme } from './theme.js';

const filesToProbe = [
  './theme.js',
  './db.js',
  './app.js'
];

function show(msg) {
  const el = document.getElementById('app') || document.body;
  el.innerHTML = `<pre style="background:#fee2e2;border:1px solid #fecaca;color:#991b1b;
    padding:12px;border-radius:10px;font-family:ui-monospace;white-space:pre-wrap">${msg}</pre>`;
}

async function tail(url){
  try{
    const r = await fetch(url + '?cb=' + Date.now());
    const txt = await r.text();
    const last = txt.slice(-220);
    return { ok:true, len: txt.length, last };
  }catch(e){
    return { ok:false, err: String(e) };
  }
}

try{
  await applyTheme();
  // Probe files first
  let report = 'Budgeteer startup error:\n\n';
  for(const f of filesToProbe){
    const t = await tail(f);
    if (!t.ok) {
      report += `❌ ${f} fetch failed: ${t.err}\n`;
    } else {
      report += `✔ ${f} length=${t.len}\n…tail…\n${t.last}\n\n`;
    }
  }
  // Now try to import the app
  await import('./app.js?cb=' + Date.now());
} catch (e){
  show(`Budgeteer failed to start.\n\n${e.stack || e.message || e}`);
}
