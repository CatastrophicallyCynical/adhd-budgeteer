// Apply the saved theme/colors to <body> and CSS vars on every page
(function () {
  let meta = {};
  try { meta = JSON.parse(localStorage.getItem('budgeteer_meta')) || {}; } catch {}
  const themeName = meta.theme || 'blue';

  // If custom colors exist, use them; otherwise fall back to data-theme
  const t = (meta.themeCustom || {});
  const hasCustom = t.bg || t.panel || t.ink;

  if (hasCustom) {
    if (t.bg)    document.documentElement.style.setProperty('--bg', t.bg);
    if (t.panel) document.documentElement.style.setProperty('--panel', t.panel);
    if (t.ink)   document.documentElement.style.setProperty('--ink', t.ink);
    document.body.setAttribute('data-theme', 'custom');
  } else {
    document.body.setAttribute('data-theme', themeName);
  }
})();
