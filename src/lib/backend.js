// Capa de datos de la Arena.
//  - Con variables VITE_FIREBASE_* → Firebase (Auth + Firestore en tiempo real).
//  - Sin ellas → modo demo local: funciona entre pestañas del MISMO navegador
//    (útil para ensayar la clase o probar sin configurar nada).
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, updateDoc, getDoc, onSnapshot, collection, writeBatch, increment, serverTimestamp,
} from 'firebase/firestore';

const env = import.meta.env;
const fbConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
export const HOST_EMAIL = env.VITE_HOST_EMAIL || 'profesor@pixpro.local';
export const MODE = fbConfig.apiKey && fbConfig.projectId ? 'firebase' : 'local';

/* ------------------------------------------------------------------ Firebase */
function firebaseBackend() {
  // Dos instancias separadas: la sesión del profesor y la del estudiante no se pisan
  // aunque se abran en pestañas del mismo navegador.
  const isHostPage = () => location.hash.startsWith('#/profesor');
  const make = (name) => {
    const app = initializeApp(fbConfig, name);
    const auth = getAuth(app);
    const ready = new Promise((res) => { const u = onAuthStateChanged(auth, (x) => { u(); res(x); }); });
    return { auth, db: getFirestore(app), ready };
  };
  const inst = {};
  const cur = () => { const n = isHostPage() ? 'host' : 'student'; return (inst[n] ||= make(n === 'host' ? '[DEFAULT]' : 'student')); };
  const H = new Proxy({}, { get: (_, k) => cur()[k] });
  const room = (pin) => doc(H.db, 'rooms', pin);

  return {
    mode: 'firebase',
    async ensureStudent() {
      const { auth, ready } = cur();
      await ready;
      if (auth.currentUser && !auth.currentUser.isAnonymous) await signOut(auth);
      if (!auth.currentUser) await signInAnonymously(auth);
      return auth.currentUser.uid;
    },
    async hostSignIn(password) {
      const cred = await signInWithEmailAndPassword(cur().auth, HOST_EMAIL, password);
      return cred.user.uid;
    },
    // ¿La pestaña ya tiene la sesión del profesor? (Firebase la recuerda al recargar)
    async hostSession() {
      const { auth, ready } = cur();
      await ready;
      const u = auth.currentUser;
      return !!u && !u.isAnonymous && u.email?.toLowerCase() === HOST_EMAIL.toLowerCase();
    },
    async getRoom(pin) { const s = await getDoc(room(pin)); return s.exists() ? s.data() : null; },
    createRoom: (pin, data) => setDoc(room(pin), { ...data, createdAt: serverTimestamp() }),
    updateRoom: (pin, patch) => updateDoc(room(pin), patch),
    watchRoom: (pin, cb) => onSnapshot(room(pin), (s) => cb(s.exists() ? s.data() : null)),
    joinRoom: (pin, uid, nick) => setDoc(doc(H.db, 'rooms', pin, 'players', uid), { nick, score: 0, joinedAt: Date.now() }),
    watchPlayers: (pin, cb) => onSnapshot(collection(H.db, 'rooms', pin, 'players'), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
    submitAnswer: (pin, uid, qid, ans) => setDoc(doc(H.db, 'rooms', pin, 'answers', uid), { byQ: { [qid]: ans } }, { merge: true }),
    watchMyAnswers: (pin, uid, cb) => onSnapshot(doc(H.db, 'rooms', pin, 'answers', uid), (s) => cb(s.exists() ? s.data().byQ || {} : {})),
    watchAllAnswers: (pin, cb) => onSnapshot(collection(H.db, 'rooms', pin, 'answers'), (s) => cb(Object.fromEntries(s.docs.map((d) => [d.id, d.data().byQ || {}])))),
    async applyScores(pin, qid, rows) {
      for (let i = 0; i < rows.length; i += 400) {
        const b = writeBatch(H.db);
        rows.slice(i, i + 400).forEach((r) => b.update(doc(H.db, 'rooms', pin, 'players', r.uid), { score: increment(r.pts), [`results.${qid}`]: { ok: r.ok, pts: r.pts } }));
        await b.commit();
      }
    },
  };
}

/* ------------------------------------------------------------- Demo local */
function localBackend() {
  const KEY = 'pixpro5-arena-local-db';
  const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('pixpro5-arena') : null;
  const listeners = new Set();
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { rooms: {} }; } catch { return { rooms: {} }; } };
  const write = (fn) => { const d = read(); fn(d); localStorage.setItem(KEY, JSON.stringify(d)); emit(); chan && chan.postMessage('x'); };
  const emit = () => listeners.forEach((l) => l());
  chan && (chan.onmessage = emit);
  window.addEventListener('storage', (e) => e.key === KEY && emit());
  const watch = (sel, cb) => { const run = () => cb(sel(read())); const l = () => run(); listeners.add(l); setTimeout(run, 0); return () => listeners.delete(l); };
  const R = (d, pin) => d.rooms[pin];
  let uid = sessionStorage.getItem('pixpro5-local-uid');
  if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('pixpro5-local-uid', uid); }
  const merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) { a[k] = merge(a[k] || {}, b[k]); } else a[k] = b[k]; } return a; };

  return {
    mode: 'local',
    ensureStudent: async () => uid,
    hostSignIn: async () => 'host-' + uid,
    hostSession: async () => true,
    getRoom: async (pin) => { const r = R(read(), pin); return r ? r.state : null; },
    createRoom: async (pin, data) => write((d) => { d.rooms[pin] = { state: { ...data }, players: {}, answers: {} }; }),
    updateRoom: async (pin, patch) => write((d) => { Object.assign(R(d, pin).state, patch); }),
    watchRoom: (pin, cb) => watch((d) => (R(d, pin) ? R(d, pin).state : null), cb),
    joinRoom: async (pin, u, nick) => write((d) => { R(d, pin).players[u] = { nick, score: 0, joinedAt: Date.now() }; }),
    watchPlayers: (pin, cb) => watch((d) => Object.entries(R(d, pin)?.players || {}).map(([id, p]) => ({ id, ...p })), cb),
    submitAnswer: async (pin, u, qid, ans) => write((d) => { const a = R(d, pin).answers; a[u] = merge(a[u] || {}, { [qid]: ans }); }),
    watchMyAnswers: (pin, u, cb) => watch((d) => R(d, pin)?.answers[u] || {}, cb),
    watchAllAnswers: (pin, cb) => watch((d) => R(d, pin)?.answers || {}, cb),
    applyScores: async (pin, qid, rows) => write((d) => {
      rows.forEach((r) => { const p = R(d, pin).players[r.uid]; if (!p) return; p.score = (p.score || 0) + r.pts; p.results = { ...(p.results || {}), [qid]: { ok: r.ok, pts: r.pts } }; });
    }),
  };
}

export const api = MODE === 'firebase' ? firebaseBackend() : localBackend();
