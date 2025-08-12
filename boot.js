// boot.js — apply theme, then load app, and surface any errors to the page
import { applyTheme } from './theme.js';

function showError(err){
  const el = document.getElementById('app') || document.body;
  const msg = (err && (err.stack || err.message || String(err))) || 'Unknown error';
  el.innerHTML = `
    <div style="background:#fee2e2;border:1px solid #fecaca;color:#991b1b;
                padding:12px;border-radius:10px;font-family:ui-monospace;white-space:pre-wrap">
      Budgeteer startup error:\n\n${msg}
    </div>
  `;
  console.error('Budgeteer startup error:', err);
}

try {
  await applyTheme();
  import('./app.js').catch(showError);
} catch (e) {
  showError(e);
}
