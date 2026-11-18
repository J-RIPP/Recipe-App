// Data layer. Firestore in production (offline-first, live sync between phones).
// A local-only backend (localStorage) is used when Firebase isn't configured yet ("try it out" mode).
import { initializeApp } from 'firebase/app';
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, writeBatch,
} from 'firebase/firestore';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from 'firebase/auth';
import { BAKED_CONFIG } from '../firebase-config.js';

const CFG_KEY = 'or.firebaseConfig';
const MODE_KEY = 'or.mode';

export function getConfig() {
  if (BAKED_CONFIG?.apiKey) return BAKED_CONFIG;
  try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch { return null; }
}
export function saveConfig(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
export function clearConfig() { localStorage.removeItem(CFG_KEY); localStorage.removeItem(MODE_KEY); }
export const isBaked = () => !!BAKED_CONFIG?.apiKey;
export const getMode = () => localStorage.getItem(MODE_KEY);
export const setMode = (m) => localStorage.setItem(MODE_KEY, m);

/** Accepts the snippet copied from the Firebase console (JS object or JSON) and extracts the config. */
export function parseConfigSnippet(text) {
  const keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const cfg = {};
  for (const k of keys) {
    const m = text.match(new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`));
    if (m) cfg[k] = m[1];
  }
  return cfg.apiKey && cfg.projectId && cfg.appId ? cfg : null;
}

export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// ── Firestore backend ────────────────────────────────────────────────────────
function firebaseBackend(cfg) {
  const app = initializeApp(cfg);
  const fs = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
    ignoreUndefinedProperties: true,
  });
  const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });

  return {
    kind: 'firebase',
    projectId: cfg.projectId,
    onAuth: (cb) => onAuthStateChanged(auth, (u) => cb(u ? { email: u.email, uid: u.uid } : null)),
    signIn: (email, pw) => signInWithEmailAndPassword(auth, email.trim(), pw),
    signOut: () => signOut(auth),
    subscribe(col, cb, onErr) {
      return onSnapshot(collection(fs, col), { includeMetadataChanges: false }, (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })), snap.metadata.fromCache);
      }, (e) => { console.error(col, e); onErr?.(e); });
    },
    // Writes are not awaited by the UI: Firestore applies them locally at once and syncs when online.
    set: (col, id, data, merge = true) => setDoc(doc(fs, col, id), data, { merge }).catch((e) => console.error(e)),
    remove: (col, id) => deleteDoc(doc(fs, col, id)).catch((e) => console.error(e)),
    async get(col, id) { const s = await getDoc(doc(fs, col, id)); return s.exists() ? s.data() : null; },
    async bulkSet(col, items) {
      for (let i = 0; i < items.length; i += 400) {
        const b = writeBatch(fs);
        items.slice(i, i + 400).forEach(({ id, ...data }) => b.set(doc(fs, col, id), data, { merge: true }));
        await b.commit();
      }
    },
  };
}

// ── Local backend (no account, this device only) ────────────────────────────
function localBackend() {
  const listeners = {};
  const load = (col) => { try { return JSON.parse(localStorage.getItem('or.local.' + col) || '{}'); } catch { return {}; } };
  const save = (col, data) => {
    localStorage.setItem('or.local.' + col, JSON.stringify(data));
    const arr = Object.entries(data).map(([id, v]) => ({ id, ...v }));
    (listeners[col] || []).forEach((cb) => cb(arr, false));
  };
  return {
    kind: 'local',
    onAuth: (cb) => { cb({ email: 'This device only', uid: 'local' }); return () => {}; },
    signIn: async () => {},
    signOut: async () => { localStorage.removeItem(MODE_KEY); location.reload(); },
    subscribe(col, cb) {
      (listeners[col] ||= []).push(cb);
      const data = load(col);
      setTimeout(() => cb(Object.entries(data).map(([id, v]) => ({ id, ...v })), false));
      return () => { listeners[col] = listeners[col].filter((x) => x !== cb); };
    },
    async set(col, id, data, merge = true) {
      const all = load(col);
      all[id] = merge ? { ...(all[id] || {}), ...data } : data;
      try { save(col, all); } catch (e) { alert('This device is out of storage. Connect Firebase to store more.'); }
    },
    async remove(col, id) { const all = load(col); delete all[id]; save(col, all); },
    async get(col, id) { return load(col)[id] || null; },
    async bulkSet(col, items) {
      const all = load(col);
      items.forEach(({ id, ...d }) => { all[id] = { ...(all[id] || {}), ...d }; });
      save(col, all);
    },
  };
}

let backend = null;
export function getBackend() {
  if (backend) return backend;
  const cfg = getConfig();
  if (cfg && getMode() !== 'local') backend = firebaseBackend(cfg);
  else if (getMode() === 'local') backend = localBackend();
  return backend;
}
