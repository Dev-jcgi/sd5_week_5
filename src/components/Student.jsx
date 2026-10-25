import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/backend.js';
import { QMAP, OPINION } from '../data/rounds.js';
import { store, celebrate } from '../lib/fx.js';
import SlideStage from './SlideStage.jsx';
import { QuestionCard, RevealCard, Leaderboard, Podium } from './Game.jsx';
import { SLIDES } from '../lib/slides.js';

function Join({ onJoined }) {
  const saved = store.get('pixpro5-student') || {};
  const [pin, setPin] = useState(new URLSearchParams(location.hash.split('?')[1] || '').get('pin') || saved.pin || '');
  const [nick, setNick] = useState(saved.nick || '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const p = pin.trim(), n = nick.trim().slice(0, 20);
    if (!/^\d{6}$/.test(p)) return setMsg('El PIN tiene 6 dígitos. Revísalo en la pantalla del salón.');
    if (!n) return setMsg('Escribe un apodo para el ranking.');
    setBusy(true); setMsg('');
    try {
      const uid = await api.ensureStudent();
      const room = await api.getRoom(p);
      if (!room || room.closed || room.week !== 5) { setBusy(false); return setMsg('No hay una sala abierta de la Semana 5 con ese PIN.'); }
      const already = await new Promise((res) => { const un = api.watchPlayers(p, (ps) => { setTimeout(() => un(), 0); res(ps.find((x) => x.id === uid)); }); });
      if (!already) await api.joinRoom(p, uid, n);
      store.set('pixpro5-student', { pin: p, nick: n });
      onJoined({ pin: p, uid, nick: already ? already.nick : n });
    } catch (err) {
      setBusy(false);
      setMsg('No se pudo entrar a la sala. Revisa tu conexión e inténtalo de nuevo.');
      console.error(err);
    }
  };
  return (
    <form className="panel narrow" onSubmit={submit}>
      <p className="eyebrow">Arena PixPro · estudiante</p>
      <h1 className="h-lg">Entra a la clase</h1>
      <div className="field"><label htmlFor="pin">PIN de la sala</label><input id="pin" inputMode="numeric" maxLength={6} autoComplete="off" placeholder="000000" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></div>
      <div className="field"><label htmlFor="nick">Tu apodo</label><input id="nick" autoFocus={!!pin} maxLength={20} placeholder="p. ej. Digester_Ninja" value={nick} onChange={(e) => setNick(e.target.value)} /></div>
      <button className="btn" disabled={busy}>{busy ? 'Entrando…' : 'Unirme'}</button>
      {msg && <p className="note bad" role="alert">{msg}</p>}
    </form>
  );
}

export default function Student() {
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(undefined);
  const [players, setPlayers] = useState([]);
  const [mine, setMine] = useState({});
  const seen = useRef({});
  const [sent, setSent] = useState({});

  useEffect(() => {
    if (!me) return;
    const u1 = api.watchRoom(me.pin, setRoom);
    const u2 = api.watchPlayers(me.pin, setPlayers);
    const u3 = api.watchMyAnswers(me.pin, me.uid, setMine);
    return () => { u1(); u2(); u3(); };
  }, [me]);

  const myPlayer = players.find((p) => p.id === me?.uid);
  useEffect(() => {
    if (room?.status === 'reveal' && room.reveal && (myPlayer?.results?.[room.reveal.qid]?.ok || myPlayer?.results?.[room.reveal.qid]?.pts)) celebrate(QMAP[room.reveal.qid]?.round.double);
    if (room?.status === 'end') celebrate(true);
  }, [room?.status, room?.seq]);

  if (!me) return <div className="page center-page"><Join onJoined={setMe} /></div>;
  if (room === undefined) return <div className="page center-page"><p className="note">Conectando con la sala…</p></div>;
  if (room && room.closed && room.final) {
    const mineF = room.final.ranking.find((x) => x.nick === myPlayer?.nick);
    return (
      <div className="page center-page">
        <Podium players={players} me={me.uid} />
        <div className="panel narrow"><h2>¡Fin de la clase!</h2>
          <p className="exp">{mineF ? `Terminaste en el lugar #${mineF.pos} con ${mineF.score} pts.` : 'Gracias por participar.'}</p>
          <button className="btn" onClick={() => setMe(null)}>Entrar a otra sala</button></div>
      </div>
    );
  }
  if (!room || room.closed) return <div className="page center-page"><div className="panel narrow"><h2>La sala se cerró</h2><p className="exp">Gracias por participar.</p><button className="btn" onClick={() => setMe(null)}>Entrar a otra sala</button></div></div>;

  const q = room.qid ? QMAP[room.qid] : null;
  const key = `${room.seq}`;
  if (room.status === 'question' && !seen.current[key]) seen.current[key] = Date.now();
  const answered = q && (mine[q.id] || sent[q.id]);

  const send = async (c, ms) => {
    setSent((s) => ({ ...s, [q.id]: true }));
    try { await api.submitAnswer(me.pin, me.uid, q.id, { c: c === null ? -1 : c, ms: Math.round(ms) }); }
    catch (e) { console.error(e); }
  };

  let body;
  if (room.status === 'question' && q) {
    body = answered
      ? <div className="qcard"><p className="eyebrow">Respuesta enviada</p><h2>{OPINION.has(q.type) ? '¡Respuesta registrada!' : 'Listo. Espera la revelación'}</h2><p className="exp">El profesor mostrará la respuesta en cuanto todos contesten o se acabe el tiempo.</p></div>
      : <QuestionCard key={q.id + room.seq} q={q} t0={seen.current[key]} interactive onAnswer={send} />;
  } else if (room.status === 'reveal' && q) {
    body = <RevealCard q={q} reveal={room.reveal} mine={myPlayer?.results?.[q.id] || null} score={myPlayer?.score || 0} />;
  } else if (room.status === 'board') {
    body = <Leaderboard players={players} me={me.uid} title="Ranking final" />;
  } else if (room.status === 'end') {
    body = <Podium players={players} me={me.uid} />;
  } else {
    body = (
      <div className="student-slide">
        <SlideStage index={Math.min(room.slide || 0, SLIDES.length - 1)} />
        <p className="note center-t mono">Diapositiva {(room.slide || 0) + 1} de {SLIDES.length} · sincronizada con el profesor</p>
      </div>
    );
  }

  return (
    <div className="page student">
      <header className="sbar">
        <span className="chip mono">PIN {me.pin}</span>
        <span className="who">{me.nick}</span>
        <span className="chip mono">{myPlayer?.score || 0} pts</span>
      </header>
      <main className="sbody">{body}</main>
    </div>
  );
}
