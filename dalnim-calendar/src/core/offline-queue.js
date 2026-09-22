// Persists cloud-mode writes that failed because the network was unreachable, so they can be
// retried once connectivity returns. Falls back to an in-memory list where IndexedDB is unavailable
// (server-side tests) so the same class stays testable without a browser.
export class OfflineQueue {
  constructor(name='dalnim-offline-queue') { this.name = name; this.mem = []; }
  async init() {
    if (typeof indexedDB === 'undefined') { this.db = null; return this; }
    this.db = await new Promise((resolve, reject) => {
      const r = indexedDB.open(this.name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('queue', {keyPath:'localId', autoIncrement:true});
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    return this;
  }
  async enqueue(entry) {
    if (!this.db) { entry.localId = (this.mem.at(-1)?.localId || 0) + 1; this.mem.push(entry); return entry.localId; }
    return new Promise((resolve, reject) => {
      const t = this.db.transaction('queue', 'readwrite'), r = t.objectStore('queue').add(entry);
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
  }
  async list() {
    if (!this.db) return [...this.mem];
    return new Promise((resolve, reject) => {
      const r = this.db.transaction('queue').objectStore('queue').getAll();
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
  }
  async remove(localId) {
    if (!this.db) { this.mem = this.mem.filter(x => x.localId !== localId); return; }
    return new Promise((resolve, reject) => {
      const t = this.db.transaction('queue', 'readwrite'); t.objectStore('queue').delete(localId);
      t.oncomplete = () => resolve(); t.onerror = () => reject(t.error);
    });
  }
}
// A fetch()-level failure (offline, DNS, CORS-blocked) throws a TypeError before any HTTP status
// exists. A server that responded (even with 4xx/5xx) is not "offline" and must not be queued.
export const isOfflineError = err => err instanceof TypeError || err?.offline === true;
