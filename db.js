// Very small IndexedDB helper
export const idb = {
  db: null,
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("gentle-budget", 3);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
        if (!db.objectStoreNames.contains("buckets")) db.createObjectStore("buckets", { keyPath: "id" });
        if (!db.objectStoreNames.contains("transactions")) db.createObjectStore("transactions", { keyPath: "id" });
        if (!db.objectStoreNames.contains("recurring")) db.createObjectStore("recurring", { keyPath: "id" });
      };
      req.onsuccess = () => { idb.db = req.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  },
  get(store, key){ return new Promise((res, rej)=>{ const tx=this.db.transaction(store); const s=tx.objectStore(store); const r=s.get(key); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); },
  set(store, key, value){ return new Promise((res, rej)=>{ const tx=this.db.transaction(store, "readwrite"); const s=tx.objectStore(store); const r=s.put(value, key); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); },
  put(store, value){ return new Promise((res, rej)=>{ const tx=this.db.transaction(store, "readwrite"); const s=tx.objectStore(store); const r=s.put(value); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); },
  all(store){ return new Promise((res, rej)=>{ const tx=this.db.transaction(store); const s=tx.objectStore(store); const r=s.getAll(); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); },
};