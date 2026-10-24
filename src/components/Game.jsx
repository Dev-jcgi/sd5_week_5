import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { LETTERS } from '../data/rounds.js';

const TILE = ['tA', 'tB', 'tC', 'tD', 'tE'];

function useCountdown(q, t0) {
  const [left, setLeft] = useState(q.t * 1000);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, q.t * 1000 - (Date.now() - t0)));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [q.id, t0]);
  return left;
}

function useEnter(ref, deps) {
  useEffect(() => {
    if (!ref.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.from(ref.current.children, { y: 18, opacity: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out', clearProps: 'all' });
  }, deps);
}

export function RoundChip({ q }) {
  return <span className="chip">Ronda {q.round.n} · {q.round.phase}{q.round.double ? ' · puntos dobles' : ''}</span>;
}

/** Pregunta con temporizador. interactive=true para el estudiante; false para la pantalla del profesor. */
export function QuestionCard({ q, t0, interactive, onAnswer, big, answered, total }) {
  const left = useCountdown(q, t0);
  const [picked, setPicked] = useState(null);
  const [order, setOrder] = useState([]);
  const done = picked !== null || left <= 0;
  const grid = useRef(null);
  useEnter(grid, [q.id]);
  useEffect(() => { setPicked(null); setOrder([]); }, [q.id]);
  useEffect(() => {
    if (interactive && left <= 0 && picked === null) { setPicked(-1); onAnswer(null, q.t * 1000); }
  }, [left]);

  const choose = (c) => { if (!interactive || done) return; setPicked(c); onAnswer(c, Date.now() - t0); };

  return (
    <div className={`qcard ${big ? 'big' : ''}`}>
      <div className="qhead">
        <RoundChip q={q} />
        <span className="chip mono">{left > 0 ? `${Math.ceil(left / 1000)} s` : 'Tiempo'}</span>
        {total != null && <span className="chip mono">{answered}/{total} respondieron</span>}
      </div>
      <div className="timer"><i style={{ transform: `scaleX(${left / (q.t * 1000)})` }} /></div>
      <h2 className="qtext">{q.q}</h2>
      {q.type === 'order' ? (
        <div className="order" ref={grid}>
          {q.o.map((o, i) => {
            const pos = order.indexOf(i);
            return (
              <button key={i} className={`ord ${pos > -1 ? 'on' : ''}`} disabled={!interactive || done}
                onClick={() => !order.includes(i) && setOrder([...order, i])}>
                <span className="n">{pos > -1 ? pos + 1 : interactive ? '' : LETTERS[i]}</span><span>{o}</span>
              </button>
            );
          })}
          {interactive && !done && (
            <div className="row-btns">
              <button className="btn ghost" onClick={() => setOrder([])}>Reiniciar</button>
              <button className="btn" disabled={order.length !== q.o.length} onClick={() => choose(order)}>Enviar orden</button>
            </div>
          )}
          {interactive && !done && <p className="note">Toca los pasos en el orden correcto.</p>}
        </div>
      ) : (
        <div className={`tiles ${q.o.length === 2 ? 'two' : ''}`} ref={grid}>
          {q.o.map((o, i) => (
            <button key={i} className={`tile ${TILE[i]} ${picked === i ? 'picked' : picked !== null && picked !== -1 ? 'dim' : ''}`}
              disabled={!interactive || done} onClick={() => choose(i)}>
              <span className="L">{LETTERS[i]}</span><span>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Resultado de la pregunta: distribución y respuesta correcta (profesor y estudiantes). */
export function RevealCard({ q, reveal, mine, score, big }) {
  const ref = useRef(null);
  useEnter(ref, [q.id]);
  const n = reveal?.n || 0;
  let head = null;
  if (mine !== undefined) {
    if (q.type === 'poll') head = <p className="big">¡Gracias por votar!</p>;
    else if (!mine) head = <p className="big bad">Sin respuesta</p>;
    else if (mine.ok) head = <><p className="big ok">+{mine.pts}</p><p className="ok"><b>¡Correcto!</b></p></>;
    else head = <><p className="big bad">0</p><p className="bad"><b>Esta vez no</b></p></>;
  }
  return (
    <div className={`qcard reveal ${big ? 'big' : ''}`} ref={ref}>
      <div className="qhead"><RoundChip q={q} /><span className="chip mono">{n} respuestas{q.type !== 'poll' ? ` · ${reveal?.okCount || 0} correctas` : ''}</span></div>
      {head}
      <h2 className="qtext small">{q.q}</h2>
      {q.type === 'order' ? (
        <ol className="answer-order">{(reveal?.a || []).map((i) => <li key={i}>{q.o[i]}</li>)}</ol>
      ) : (
        <div className="dist">
          {q.o.map((o, i) => {
            const c = reveal?.dist?.[i] || 0;
            const right = q.type !== 'poll' && reveal?.a === i;
            return (
              <div key={i} className={`dbar ${right ? 'right' : ''}`}>
                <span className="mono">{LETTERS[i]}</span>
                <div className="tr"><i style={{ width: `${n ? (c * 100) / n : 0}%`, background: `var(--tile${LETTERS[i]})` }} /><span className="lbl">{o}</span></div>
                <span className="mono">{c}{right ? ' ✓' : ''}</span>
              </div>
            );
          })}
        </div>
      )}
      {reveal?.e && <p className="exp">{reveal.e}</p>}
      {score != null && <p className="note mono">Tu total: {score} pts</p>}
    </div>
  );
}

export function Leaderboard({ players, me, limit = 5, title = 'Ranking' }) {
  const ref = useRef(null);
  useEnter(ref, [players.length]);
  const r = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const pos = r.findIndex((p) => p.id === me);
  return (
    <div className="qcard">
      <p className="eyebrow center-t">{title}</p>
      <div className="board" ref={ref}>
        {r.slice(0, limit).map((p, i) => (
          <div key={p.id} className={`lrow ${p.id === me ? 'me' : ''}`}>
            <span className="r mono">#{i + 1}</span><span className="nm">{p.nick}{p.id === me ? ' · tú' : ''}</span><span className="s mono">{p.score || 0}</span>
          </div>
        ))}
        {!r.length && <p className="note">Aún no hay jugadores.</p>}
        {pos >= limit && <p className="note center-t">Tu posición: #{pos + 1} de {r.length}</p>}
      </div>
    </div>
  );
}

export function Podium({ players, me }) {
  const r = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const slots = [[1, 'var(--tileB)', 170], [0, 'var(--tileC)', 230], [2, 'var(--tileA)', 130]];
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      gsap.from(ref.current.children, { scaleY: 0, transformOrigin: 'bottom', duration: 0.8, stagger: 0.25, ease: 'back.out(1.6)' });
  }, []);
  const mine = r.findIndex((p) => p.id === me);
  return (
    <div className="qcard">
      <p className="eyebrow center-t">Fin de la partida</p>
      <h2 className="center-t">Podio de la Arena</h2>
      <div className="podium" ref={ref}>
        {slots.map(([k, bg, h]) => (
          <div key={k} className="pod" style={{ background: bg, height: h }}>
            {r[k] ? <><span className="p mono">{k + 1}</span><span>{r[k].nick}</span><span className="mono">{r[k].score || 0}</span></> : <span className="mono">—</span>}
          </div>
        ))}
      </div>
      {me && mine > -1 && <p className="note center-t mono">Tu lugar: #{mine + 1} · {r[mine].score || 0} pts</p>}
    </div>
  );
}
