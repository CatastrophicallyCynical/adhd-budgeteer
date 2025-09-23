const SOURCE = new URL('./affirmations.json', import.meta.url);
let cachedList = null;
let lastIndex = -1;

async function fetchAffirmations(){
  if (cachedList) return cachedList;
  try{
    const res = await fetch(SOURCE, { cache: 'no-store' });
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    if (Array.isArray(data)){
      cachedList = data.filter(item => typeof item === 'string' && item.trim().length);
      if (cachedList.length) return cachedList;
    }
  }catch(err){
    console.warn('Budgeteer: failed to load affirmations', err);
  }
  cachedList = [];
  return cachedList;
}

function pickRandom(list){
  if (!list.length) return 'You are doing enough.';
  if (list.length === 1) return list[0];
  let idx = Math.floor(Math.random() * list.length);
  if (idx === lastIndex){
    idx = (idx + 1) % list.length;
  }
  lastIndex = idx;
  return list[idx];
}

export async function refreshAffirmations(){
  const nodes = document.querySelectorAll('.affirmation');
  if (!nodes.length) return;
  const list = await fetchAffirmations();
  const text = pickRandom(list);
  nodes.forEach(node => { node.textContent = text; });
}

export function initAffirmations(){
  const run = () => { refreshAffirmations(); };
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }else{
    Promise.resolve().then(run);
  }
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) refreshAffirmations();
  });
}

window.Budgeteer_refreshAffirmations = refreshAffirmations;
