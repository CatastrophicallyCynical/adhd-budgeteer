// theme.js — load saved theme colors and apply to CSS vars
export async function applyTheme() {
  // IndexedDB tiny read without full helper
  const req = indexedDB.open('gentle-budget');
  return new Promise((resolve) => {
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['settings']);
      const store = tx.objectStore('settings');
      const get = store.get('app');
      get.onsuccess = () => {
        const s = get.result || {};
        const t = (s.themeCustom) || {};
        if (t.bg)    document.documentElement.style.setProperty('--bg', t.bg);
        if (t.panel) document.documentElement.style.setProperty('--panel', t.panel);
        if (t.ink)   document.documentElement.style.setProperty('--ink', t.ink);
        resolve();
      };
      get.onerror = () => resolve();
    };
    req.onerror = () => resolve();
  });
}
