// app.js — Budgeteer main logic

let meta = { theme: 'blue', version: 1 };
let expenses = [];
let income = [];
let recurring = [];

// --- Utility: Save & Load from localStorage ---
function saveData() {
  localStorage.setItem('budgeteer_meta', JSON.stringify(meta));
  localStorage.setItem('budgeteer_expenses', JSON.stringify(expenses));
  localStorage.setItem('budgeteer_income', JSON.stringify(income));
  localStorage.setItem('budgeteer_recurring', JSON.stringify(recurring));
}

function loadData() {
  meta = JSON.parse(localStorage.getItem('budgeteer_meta')) || { theme: 'blue', version: 1 };
  expenses = JSON.parse(localStorage.getItem('budgeteer_expenses')) || [];
  income = JSON.parse(localStorage.getItem('budgeteer_income')) || [];
  recurring = JSON.parse(localStorage.getItem('budgeteer_recurring')) || [];
}

// --- Render Buckets & Home Page ---
function renderBuckets() {
  const container = document.getElementById('bucketList');
  if (!container) return;

  container.innerHTML = '';
  const buckets = {};

  expenses.forEach(e => {
    if (!buckets[e.category]) buckets[e.category] = [];
    buckets[e.category].push(e);
  });

  Object.keys(buckets).forEach(cat => {
    const total = buckets[cat].reduce((sum, e) => sum + Number(e.amount), 0);
    const section = document.createElement('div');
    section.className = 'bucket-card';
    section.innerHTML = `
      <h3>${cat} = $${total.toFixed(2)} this Month</h3>
      <button onclick="toggleBucket('${cat}')">Expand</button>
      <div id="bucket-${cat}" class="bucket-items" style="display:none">
        ${buckets[cat].map((e, i) => `
          <div class="bucket-item">
            ${e.name} - $${e.amount} (${e.date})
            <button onclick="editExpense('${cat}', ${i})">Edit</button>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(section);
  });
}

function toggleBucket(cat) {
  const el = document.getElementById(`bucket-${cat}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// --- Expense Editing ---
function editExpense(cat, index) {
  const exp = expenses.filter(e => e.category === cat)[index];
  if (!exp) return;
  const newName = prompt('Edit name:', exp.name);
  const newAmt = prompt('Edit amount:', exp.amount);
  if (newName && newAmt) {
    exp.name = newName;
    exp.amount = Number(newAmt);
    saveData();
    renderBuckets();
  }
}

// --- Adding Expense ---
function addExpense(name, amount, category, date) {
  expenses.push({ name, amount: Number(amount), category, date });
  saveData();
  renderBuckets();
}

// --- Adding Income ---
function addIncome(name, amount, date) {
  income.push({ name, amount: Number(amount), date });
  saveData();
}

// --- Theme Handling ---
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  meta.theme = theme;
  saveData();
}

// --- Danger Zone: Delete All Data ---
function deleteAllData() {
  if (!confirm('Are you sure??')) return;
  if (!confirm('ARE YOU SURE DUDE??')) return;
  localStorage.clear();
  loadData();
  renderBuckets();
}

// --- Init ---
(function init() {
  loadData();
  applyTheme(meta.theme);
  renderBuckets();
})();
