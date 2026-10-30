/* Almacenamiento clave/valor en IndexedDB (con respaldo en localStorage) */
const KV = (() => {
  let dbp = null;
  let usarLS = !('indexedDB' in window);

  function open() {
    return (dbp ||= new Promise((res, rej) => {
      const r = indexedDB.open('kiosco', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('kv', mode);
      const req = fn(t.objectStore('kv'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }

  async function get(k) {
    if (!usarLS) {
      try { return await tx('readonly', s => s.get(k)); } catch { usarLS = true; }
    }
    try { return JSON.parse(localStorage.getItem('kv:' + k)); } catch { return null; }
  }

  async function set(k, v) {
    if (!usarLS) {
      try { return await tx('readwrite', s => s.put(v, k)); } catch { usarLS = true; }
    }
    localStorage.setItem('kv:' + k, JSON.stringify(v));
  }

  async function del(k) {
    if (!usarLS) {
      try { return await tx('readwrite', s => s.delete(k)); } catch { usarLS = true; }
    }
    localStorage.removeItem('kv:' + k);
  }

  return { get, set, del };
})();
