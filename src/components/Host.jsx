import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, MODE } from '../lib/backend.js';
import { decryptJSON } from '../lib/crypto.js';
import encrypted from '../data/answers.enc.json';
import { ROUNDS, QMAP, ROUND_BY_SLIDE, points, isCorrect } from '../data/rounds.js';
import { SLIDES, SECTIONS } from '../lib/slides.js';
import { store, newPin, celebrate } from '../lib/fx.js';
import SlideStage from './SlideStage.jsx';
import JoinQR, { joinUrl } from './JoinQR.jsx';
import { QuestionCard, RevealCard, Leaderboard, Podium } from './Game.jsx';

/* ---------- ranking final: cálculo, CSV e historial ---------- */
const HKEY = 'pixpro5-history';
export function buildRanking(players) {
  return [...players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => {
    const r = p.results || {};
    return { pos: i + 1, nick: p.nick, score: p.score || 0, ok: Object.values(r).filter((x) => x.ok === true).length, answered: Object.keys(r).length, results: r };
  });
}
function downloadCsv(pin, ranking, scored, at) {
  const head = ['posición', 'apodo', 'puntos', 'correctas', 'respondidas', ...scored];
  const rows = ranking.map((x) => [x.pos, x.nick, x.score, x.ok, x.answered, ...scored.map((id) => (x.results?.[id] ? x.results[id].pts : ''))]);
  const csv = '\uFEFF' + [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const d = new Date(at || Date.now());
  a.download = `ranking-arena-${pin}-${d.toISOString().slice(0, 10)}.csv`;
  a.click();
}
const history = () => store.get(HKEY) || [];

/* ---------- acceso con contraseña ---------- */
function Login({ onOk }) {
  const [pwd, setPwd] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    let key;
    try { key = await decryptJSON(encrypted, pwd); }
    catch { setBusy(false); return setMsg('Contraseña incorrecta.'); }
    try { await api.hostSignIn(pwd); }
    catch (err) {
      console.error(err); setBusy(false);
      return setMsg('La contraseña es correcta, pero Firebase rechazó el inicio de sesión. Revisa que exista la cuenta del profesor (README, paso 3).');
    }
    onOk(key);
  };
  return (
    <form className="panel narrow" onSubmit={submit}>
      <p className="eyebrow">Acceso del profesor</p>
      <h1 className="h-lg">Iniciar la clase</h1>
      <p className="exp">Solo con la contraseña del profesor se puede abrir una sala, avanzar las diapositivas y lanzar preguntas.</p>
      <div className="field"><label htmlFor="pwd">Contraseña</label><input id="pwd" type="password" autoComplete="current-password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
      <button className="btn" disabled={busy || !pwd}>{busy ? 'Verificando…' : 'Entrar'}</button>
      {msg && <p className="note bad" role="alert">{msg}</p>}
      <p className="note mono">Versión {__BUILD__}</p>
    </form>
  );
}

/* ---------- elegir o crear sala ---------- */
function Lobby({ onRoom }) {
  const last = store.get('pixpro5-host-pin');
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    const pin = newPin();
    await api.createRoom(pin, { pin, status: 'slide', slide: 0, seq: 0, qid: null, reveal: null, scored: [], closed: false, week: 5 });
    store.set('pixpro5-host-pin', pin);
    onRoom(pin);
  };
  const resume = async () => { setBusy(true); const r = await api.getRoom(last); if (r && !r.closed) onRoom(last); else { setBusy(false); store.set('pixpro5-host-pin', null); alertMsg(); } };
  const [gone, setGone] = useState(false);
  const alertMsg = () => setGone(true);
  return (
    <div className="panel narrow">
      <p className="eyebrow">Sala de clase</p>
      <h1 className="h-lg">Abre la Arena</h1>
      <p className="exp">Se genera un PIN de 6 dígitos. Los estudiantes entran desde la página principal con ese PIN y su apodo.</p>
      <button className="btn" onClick={create} disabled={busy}>Crear sala nueva</button>
      {last && <button className="btn ghost" onClick={resume} disabled={busy}>Retomar sala {last}</button>}
      {gone && <p className="note">Esa sala ya no está disponible. Crea una nueva.</p>}
      {history().length > 0 && (
        <div className="history">
          <p className="eyebrow">Rankings guardados</p>
          {history().slice(0, 8).map((h) => (
            <div key={h.pin + h.at} className="hrow">
              <span className="mono">{new Date(h.at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })} · PIN {h.pin}</span>
              <span>{h.ranking.length} jug. · 1.º {h.ranking[0]?.nick || '—'}</span>
              <button className="cbtn" onClick={() => downloadCsv(h.pin, h.ranking, h.scored, h.at)}>CSV</button>
            </div>
          ))}
        </div>
      )}
      {MODE === 'local' && <p className="note">Modo demo local: los estudiantes deben abrir la página en otra pestaña de este mismo navegador.</p>}
    </div>
  );
}

/* ---------- presentación + control del juego ---------- */
function Presenter({ pin, keyMap, onExit, onNewRoom, intro = true }) {
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [answers, setAnswers] = useState({});
  const [drawer, setDrawer] = useState(false);
  const [showPin, setShowPin] = useState(intro);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const a = api.watchRoom(pin, setRoom), b = api.watchPlayers(pin, setPlayers), c = api.watchAllAnswers(pin, setAnswers);
    return () => { a(); b(); c(); };
  }, [pin]);

  const update = useCallback((patch) => api.updateRoom(pin, patch).catch((e) => console.error(e)), [pin]);
  const slide = room?.slide || 0;
  const status = room?.status || 'slide';
  const q = room?.qid ? QMAP[room.qid] : null;
  const round = ROUND_BY_SLIDE[SLIDES[slide]?.id] || null;

  const go = useCallback((i) => { if (i >= 0 && i < SLIDES.length) update({ slide: i, status: 'slide', qid: null, reveal: null }); }, [update]);
  const isLast = slide === SLIDES.length - 1;
  const finalBoard = () => update({ status: 'board', qid: null, reveal: null });
  const launch = (qq) => update({ status: 'question', qid: qq.id, seq: (room.seq || 0) + 1, startedAt: Date.now(), reveal: null });

  const answeredCount = q ? players.filter((p) => answers[p.id]?.[q.id]).length : 0;

  const reveal = async () => {
    if (!q || busy) return;
    setBusy(true);
    const k = keyMap[q.id] || null;
    const dist = q.o.map(() => 0);
    const rows = [];
    let n = 0, okCount = 0;
    players.forEach((p) => {
      const a = answers[p.id]?.[q.id];
      if (!a) return;
      n++;
      if (typeof a.c === 'number' && a.c >= 0) dist[a.c]++;
      const ok = q.type === 'poll' ? null : a.c === -1 ? false : isCorrect(q, k, a.c);
      if (ok) okCount++;
      rows.push({ uid: p.id, ok, pts: points(q, ok === true, a.ms) });
    });
    try {
      if (!(room.scored || []).includes(q.id)) await api.applyScores(pin, q.id, rows);
      await update({ status: 'reveal', scored: [...new Set([...(room.scored || []), q.id])], reveal: { qid: q.id, a: k ? k.a : null, e: k ? k.e : null, dist, n, okCount } });
      if (okCount) celebrate(q.round.double);
    } finally { setBusy(false); }
  };

  const nextInRound = () => {
    const r = q.round; const i = r.qs.findIndex((x) => x.id === q.id);
    if (i < r.qs.length - 1) launch(QMAP[r.qs[i + 1].id]); else go(Math.min(slide + 1, SLIDES.length - 1));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input,textarea')) return;
      if (status === 'slide' && ['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); if (slide === SLIDES.length - 1) finalBoard(); else go(slide + 1); }
      if (status === 'slide' && ['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(slide - 1); }
      if (e.key === 'f' || e.key === 'F') document.documentElement.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, slide, go, finalBoard]);

  const exportCsv = () => downloadCsv(pin, buildRanking(players), room.scored || [], Date.now());

  // Final: guarda el ranking (en la sala de Firebase y en este navegador), descarga el CSV y cierra la sala.
  const [ending, setEnding] = useState(false);
  const finish = async () => {
    if (!confirm('¿Terminar la clase? Se guardará el ranking, se descargará el CSV y la sala se cerrará para los estudiantes.')) return;
    setEnding(true);
    const ranking = buildRanking(players);
    const at = Date.now();
    const scored = room.scored || [];
    try {
      await update({ status: 'end', closed: true, endedAt: at, final: { at, ranking: ranking.map(({ results, ...x }) => x) } });
      store.set(HKEY, [{ pin, at, scored, ranking }, ...history()].slice(0, 30));
      downloadCsv(pin, ranking, scored, at);
      store.set('pixpro5-host-pin', null);
      celebrate(true);
    } finally { setEnding(false); setDrawer(false); setShowPin(false); }
  };

  const log = useMemo(() => (room?.scored || []).map((id) => {
    const qq = QMAP[id]; const rs = players.map((p) => p.results?.[id]).filter(Boolean);
    return { q: qq, n: rs.length, ok: rs.filter((x) => x.ok === true).length };
  }), [room?.scored, players]);

  if (!room) return <div className="page center-page"><p className="note">Abriendo sala…</p></div>;

  if (room.closed && room.final) {
    return (
      <div className="final-page">
        <Podium players={players} />
        <div className="qcard">
          <p className="eyebrow center-t">Ranking guardado · {new Date(room.final.at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          <div className="board">
            {room.final.ranking.map((x) => <div key={x.pos} className="lrow"><span className="r mono">#{x.pos}</span><span className="nm">{x.nick}</span><span className="s mono">{x.score}</span></div>)}
            {!room.final.ranking.length && <p className="note">No hubo jugadores.</p>}
          </div>
          <div className="row-btns">
            <button className="btn ghost" onClick={() => downloadCsv(pin, buildRanking(players), room.scored || [], room.final.at)}>Descargar CSV otra vez</button>
            <button className="btn" onClick={onNewRoom}>Nueva sesión</button>
            <button className="btn ghost" onClick={onExit}>Salir al inicio</button>
          </div>
        </div>
      </div>
    );
  }

  let stage;
  if (status === 'question' && q) stage = <div className="host-game"><QuestionCard key={q.id + room.seq} q={q} t0={room.startedAt} big answered={answeredCount} total={players.length} /></div>;
  else if (status === 'reveal' && q) stage = <div className="host-game"><RevealCard q={q} reveal={room.reveal} big /></div>;
  else if (status === 'board') stage = <div className="host-game"><Leaderboard players={players} limit={10} title="Ranking final" /></div>;
  else if (status === 'end') stage = <div className="host-game"><Podium players={players} /></div>;
  else stage = <SlideStage index={slide} className="host-stage" />;

  return (
    <div className="presenter">
      <div className="pin-badge" title="PIN de la sala">
        <span className="mono">PIN</span><b className="mono">{pin}</b><span className="mono">{players.length} jug.</span>
      </div>
      <div className="present-area">{stage}</div>

      {showPin && (
        <div className="pin-overlay" role="dialog" aria-label="Entrar a la sala">
          <p className="eyebrow">Escanea para entrar a la Arena</p>
          <div className="join-grid">
            <JoinQR pin={pin} size={320} />
            <div className="join-info">
              <p className="note mono">PIN de la sala</p>
              <p className="pin">{pin}</p>
              <p className="exp">O abre <b className="mono">{location.origin + location.pathname}</b>, toca “Soy estudiante” y escribe el PIN.</p>
              <p className="note mono">{players.length} jugadores conectados</p>
            </div>
          </div>
          <div className="nicks">{players.map((p) => <span key={p.id} className="nick">{p.nick}</span>)}</div>
          <div className="row-btns">
            <button className="btn" onClick={() => setShowPin(false)}>Empezar la clase</button>
            <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(joinUrl(pin)).catch(() => {})}>Copiar enlace</button>
            <button className="btn ghost" onClick={onNewRoom}>Nueva sesión (nuevo PIN y QR)</button>
          </div>
        </div>
      )}

      <nav className="ctrl" aria-label="Controles del profesor">
        {status === 'slide' && <>
          <button className="cbtn" onClick={() => go(slide - 1)} aria-label="Anterior">◀</button>
          <span className="mono cnum">{slide + 1}/{SLIDES.length}</span>
          <button className="cbtn" onClick={() => go(slide + 1)} aria-label="Siguiente">▶</button>
          {round && <button className="btn" onClick={() => launch(QMAP[round.qs[0].id])}>Lanzar ronda {round.n}</button>}
          {isLast && <button className="btn" onClick={finalBoard}>Ver ranking final</button>}
        </>}
        {status === 'question' && <>
          <span className="mono cnum">{answeredCount}/{players.length} respondieron</span>
          <button className="btn" onClick={reveal} disabled={busy}>Revelar respuesta</button>
        </>}
        {status === 'reveal' && q && <button className="btn" onClick={nextInRound}>{q.round.qs[q.round.qs.length - 1].id === q.id ? 'Volver a las diapositivas' : 'Siguiente pregunta'}</button>}
        {status === 'board' && <>
          <button className="btn" onClick={() => update({ status: 'end' })}>Mostrar podio</button>
          <button className="btn ghost" onClick={() => update({ status: 'slide' })}>Volver a las diapositivas</button>
        </>}
        {status === 'end' && <button className="btn ghost" onClick={() => update({ status: 'slide' })}>Volver a las diapositivas</button>}
        <span className="grow" />
        <button className="cbtn" onClick={() => setShowPin(true)}>PIN / QR</button>
        <button className="cbtn final" onClick={finish} disabled={ending}>{ending ? 'Guardando…' : 'Final'}</button>
        <button className="cbtn" onClick={() => setDrawer(!drawer)} aria-expanded={drawer}>Panel</button>
        <button className="cbtn" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} aria-label="Pantalla completa">⛶</button>
      </nav>

      {drawer && (
        <aside className="drawer">
          <div className="drawer-h"><h3>Panel de la clase</h3><button className="cbtn" onClick={() => setDrawer(false)}>Cerrar</button></div>
          <p className="eyebrow">Secciones</p>
          <div className="jump">{SECTIONS.map((s) => <button key={s.start} className="qbtn" onClick={() => go(s.index)}>{s.index + 1}. {s.title}</button>)}</div>
          <p className="eyebrow">Lanzar cualquier ronda</p>
          <div className="jump">{ROUNDS.map((r) => <button key={r.id} className="qbtn" onClick={() => { update({ slide: SLIDES.findIndex((s) => s.id === r.slide) }); launch(QMAP[r.qs[0].id]); }}>R{r.n} · {r.phase} · {r.topic}</button>)}</div>
          <p className="eyebrow">Registro ({players.length} jugadores)</p>
          <div className="tblw"><table><thead><tr><th>Pregunta</th><th>Resp.</th><th>Correctas</th><th>%</th></tr></thead>
            <tbody>{log.map(({ q: qq, n, ok }) => <tr key={qq.id}><td>R{qq.round.n} · {qq.q.slice(0, 48)}{qq.q.length > 48 ? '…' : ''}</td><td>{n}</td><td>{qq.type === 'poll' ? '—' : ok}</td><td>{qq.type === 'poll' ? '—' : n ? Math.round((ok * 100) / n) + '%' : '0%'}</td></tr>)}
            {!log.length && <tr><td colSpan={4} className="note">Aún no se revelan preguntas.</td></tr>}</tbody></table></div>
          <Leaderboard players={players} limit={100} title="Ranking completo" />
          <div className="row-btns">
            <button className="btn ghost" onClick={exportCsv}>Exportar CSV</button>
            <button className="btn ghost" onClick={finalBoard}>Ranking final</button>
            <button className="btn" onClick={finish}>Final: cerrar y guardar ranking</button>
            <button className="btn ghost" onClick={() => update({ status: 'end' })}>Mostrar podio</button>
            <button className="btn ghost" onClick={() => { setDrawer(false); onNewRoom(); }}>Nueva sesión</button>
            <button className="btn danger" onClick={async () => { await update({ closed: true }); store.set('pixpro5-host-pin', null); onExit(); }}>Cerrar sala</button>
          </div>
          <p className="note mono">Versión {__BUILD__}</p>
        </aside>
      )}
    </div>
  );
}

const SKEY = 'pixpro5-host-key';

export default function Host() {
  const [keyMap, setKey] = useState(null);
  const [pin, setPin] = useState(null);
  const [checking, setChecking] = useState(true);
  const [intro, setIntro] = useState(true);
  const [err, setErr] = useState('');

  // Al recargar: si esta pestaña ya entró como profesor, vuelve directo a la sala sin pedir la contraseña.
  useEffect(() => {
    (async () => {
      try {
        const k = JSON.parse(sessionStorage.getItem(SKEY) || 'null');
        if (k && (await api.hostSession())) {
          setKey(k);
          const last = store.get('pixpro5-host-pin');
          if (last) { const r = await api.getRoom(last).catch(() => null); if (r && !r.closed) { setIntro(false); setPin(last); } }
        }
      } catch (e) { console.error(e); }
      setChecking(false);
    })();
  }, []);

  const login = (k) => { try { sessionStorage.setItem(SKEY, JSON.stringify(k)); } catch { /* sin almacenamiento */ } setKey(k); };
  const open = (p) => { setIntro(true); setPin(p); };

  // Nueva sesión: cierra la sala actual y abre otra con PIN (y QR) nuevos.
  const newRoom = async () => {
    setErr('');
    try { if (pin) await api.updateRoom(pin, { closed: true }); } catch (e) { console.error(e); }
    const p = newPin();
    try {
      await api.createRoom(p, { pin: p, status: 'slide', slide: 0, seq: 0, qid: null, reveal: null, scored: [], closed: false, week: 5 });
    } catch (e) {
      console.error(e);
      setErr('No se pudo crear la sala nueva: la sesión de profesor se cerró en esta pestaña (por ejemplo, si abriste la página de estudiante en este mismo navegador). Vuelve a escribir la contraseña.');
      try { sessionStorage.removeItem(SKEY); } catch { /* */ }
      setKey(null); setPin(null);
      return;
    }
    store.set('pixpro5-host-pin', p);
    open(p);
  };

  if (checking) return <div className="page center-page"><p className="note">Comprobando sesión del profesor…</p></div>;
  if (!keyMap) return <div className="page center-page">{err && <p className="note bad" role="alert" style={{ maxWidth: 560 }}>{err}</p>}<Login onOk={login} /></div>;
  if (!pin) return <div className="page center-page"><Lobby onRoom={open} /></div>;
  return <Presenter key={pin} pin={pin} keyMap={keyMap} intro={intro} onExit={() => setPin(null)} onNewRoom={newRoom} />;
}
