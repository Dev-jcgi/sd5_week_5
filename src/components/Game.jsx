import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { LETTERS, OPINION, TYPE_LABEL } from '../data/rounds.js';

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

/* ---------- entradas de las actividades nuevas (estilo Mentimeter) ---------- */
function TextInput({ q, onSend }) {
  const [v, setV] = useState('');
  const max = q.type === 'cloud' ? 24 : 140;
  const send = (e) => { e.preventDefault(); if (v.trim()) onSend(v.trim().slice(0, max)); };
  return (
    <form className="txtans" onSubmit={send}>
      {q.type === 'open'
        ? <textarea maxLength={max} rows={3} value={v} onChange={(e) => setV(e.target.value)} placeholder="Escribe aquí…" aria-label="Tu respuesta" />
        : <input maxLength={max} value={v} onChange={(e) => setV(e.target.value)} placeholder="Una palabra" aria-label="Tu palabra" autoFocus />}
      <div className="row-btns"><span className="note mono">{v.length}/{max}</span><button className="btn" disabled={!v.trim()}>Enviar</button></div>
    </form>
  );
}
function ScaleInput({ q, onSend }) {
  const [v, setV] = useState(q.o.map(() => 0));
  return (
    <div className="scale-in">
      <p className="note mono">1 = {q.lo} · 5 = {q.hi}</p>
      {q.o.map((o, i) => (
        <div key={i} className="srow"><span>{o}</span>
          <div className="sbtns">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={v[i] === n ? 'on' : ''} onClick={() => setV(v.map((x, j) => (j === i ? n : x)))} aria-label={`${o}: ${n}`}>{n}</button>)}</div>
        </div>
      ))}
      <button className="btn" disabled={v.some((x) => !x)} onClick={() => onSend(v)}>Enviar</button>
    </div>
  );
}
function PointsInput({ q, onSend }) {
  const [v, setV] = useState(q.o.map(() => 0));
  const used = v.reduce((a, b) => a + b, 0);
  const set = (i, n) => setV(v.map((x, j) => (j === i ? Math.max(0, Math.min(n, 100 - (used - x))) : x)));
  return (
    <div className="points-in">
      <p className={`note mono ${used === 100 ? 'ok' : ''}`}>Te quedan {100 - used} de 100 puntos</p>
      {q.o.map((o, i) => (
        <div key={i} className="prow"><span>{o}</span>
          <button className="cbtn" onClick={() => set(i, v[i] - 10)} aria-label={`Quitar 10 a ${o}`}>−</button>
          <b className="mono">{v[i]}</b>
          <button className="cbtn" onClick={() => set(i, v[i] + 10)} aria-label={`Sumar 10 a ${o}`}>+</button>
          <input type="range" min={0} max={100} step={5} value={v[i]} onChange={(e) => set(i, +e.target.value)} aria-label={o} />
        </div>
      ))}
      <button className="btn" disabled={used !== 100} onClick={() => onSend(v)}>Enviar</button>
    </div>
  );
}
function NumberInput({ q, onSend }) {
  const [v, setV] = useState('');
  const x = Number(String(v).replace(/,/g, ''));
  return (
    <form className="txtans" onSubmit={(e) => { e.preventDefault(); if (v !== '' && isFinite(x) && x >= 0) onSend(x); }}>
      <div className="numrow"><input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0" aria-label="Tu número" autoFocus /><span className="mono">{q.unit}</span></div>
      <button className="btn" disabled={v === '' || !isFinite(x)}>Enviar</button>
    </form>
  );
}

/* ---------- resultados agregados (en vivo y al revelar) ---------- */
const CLOUD_C = ['var(--tileC)', 'var(--tileB)', 'var(--tileA)', 'var(--tileD)', '#7FE3C4', 'var(--tileE)'];
export function Results({ q, agg, prev, answer }) {
  if (!agg) return null;
  if (q.type === 'cloud') {
    const max = agg.words[0]?.n || 1;
    return <div className="cloud">{agg.words.map(({ w, n }, i) => <span key={w} style={{ fontSize: `${18 + 46 * (n / max)}px`, color: CLOUD_C[i % CLOUD_C.length] }} title={`${n}`}>{w}</span>)}
      {!agg.words.length && <p className="note">Esperando palabras…</p>}</div>;
  }
  if (q.type === 'open') return <div className="notes">{agg.texts.map((t, i) => <p key={i} className="pnote">{t}</p>)}{!agg.texts.length && <p className="note">Esperando respuestas…</p>}</div>;
  if (q.type === 'scale' || q.type === 'points') {
    const top = q.type === 'scale' ? 5 : 100;
    return (
      <div className="dist">
        {q.o.map((o, i) => (
          <div key={i} className="dbar sbar">
            <span className="mono">{i + 1}</span>
            <div className="tr"><i style={{ width: `${(agg.avg[i] / top) * 100}%`, background: CLOUD_C[i % CLOUD_C.length] }} />
              {prev && <b className="prev" style={{ left: `${(prev.avg[i] / top) * 100}%` }} title="Inicio de la clase" />}
              <span className="lbl">{o}</span></div>
            <span className="mono">{agg.avg[i]}{prev ? <small> · antes {prev.avg[i]}</small> : ''}</span>
          </div>
        ))}
        {prev && <p className="note mono">La línea blanca marca el promedio del inicio de la clase.</p>}
      </div>
    );
  }
  if (q.type === 'number') {
    return (
      <div className="numres">
        {answer != null && <div><span className="note mono">Respuesta</span><b className="ok">{answer} {q.unit}</b></div>}
        <div><span className="note mono">Mediana del grupo</span><b>{agg.med ?? '—'}</b></div>
        <div><span className="note mono">Rango</span><b>{agg.min ?? '—'} – {agg.max ?? '—'}</b></div>
      </div>
    );
  }
  return null;
}

/** Pregunta con temporizador. interactive=true para el estudiante; false para la pantalla del profesor. */
export function QuestionCard({ q, t0, interactive, onAnswer, big, answered, total, live }) {
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
  const NEW = { cloud: TextInput, open: TextInput, scale: ScaleInput, points: PointsInput, number: NumberInput };

  let body;
  if (NEW[q.type]) {
    const In = NEW[q.type];
    body = interactive
      ? (done ? <p className="note">Enviado.</p> : <div ref={grid}><In q={q} onSend={choose} /></div>)
      : (live ? <div ref={grid}><Results q={q} agg={live} /></div>
        : <div ref={grid} className="tiles-static">{(q.o || []).map((o, i) => <span key={i} className="chip">{o}</span>)}<p className="note">Responde en tu celular.</p></div>);
  } else if (q.type === 'order') {
    body = (
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
    );
  } else {
    body = (
      <div className={`tiles ${q.o.length === 2 ? 'two' : ''}`} ref={grid}>
        {q.o.map((o, i) => (
          <button key={i} className={`tile ${TILE[i]} ${picked === i ? 'picked' : picked !== null && picked !== -1 ? 'dim' : ''}`}
            disabled={!interactive || done} onClick={() => choose(i)}>
            <span className="L">{LETTERS[i]}</span><span>{o}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`qcard ${big ? 'big' : ''}`}>
      <div className="qhead">
        <RoundChip q={q} />
        <span className="chip">{TYPE_LABEL[q.type]}</span>
        <span className="chip mono">{left > 0 ? `${Math.ceil(left / 1000)} s` : 'Tiempo'}</span>
        {total != null && <span className="chip mono">{answered}/{total} respondieron</span>}
      </div>
      <div className="timer"><i style={{ transform: `scaleX(${left / (q.t * 1000)})` }} /></div>
      <h2 className="qtext">{q.q}</h2>
      {body}
    </div>
  );
}

/** Resultado de la pregunta: distribución y respuesta correcta (profesor y estudiantes). */
export function RevealCard({ q, reveal, mine, score, big }) {
  const ref = useRef(null);
  useEnter(ref, [q.id]);
  const n = reveal?.n || 0;
  const opinion = OPINION.has(q.type);
  let head = null;
  if (mine !== undefined) {
    if (opinion) head = mine && mine.pts ? <><p className="big ok">+{mine.pts}</p><p><b>¡Gracias por participar!</b></p></> : <p className="big">¡Gracias por participar!</p>;
    else if (!mine) head = <p className="big bad">Sin respuesta</p>;
    else if (q.type === 'number') head = <><p className={`big ${mine.pts ? 'ok' : 'bad'}`}>+{mine.pts}</p><p><b>{mine.ok ? '¡Exacto!' : mine.pts ? 'Cerca' : 'Lejos esta vez'}</b></p></>;
    else if (mine.ok) head = <><p className="big ok">+{mine.pts}</p><p className="ok"><b>¡Correcto!</b></p></>;
    else head = <><p className="big bad">0</p><p className="bad"><b>Esta vez no</b></p></>;
  }
  let body;
  if (reveal?.agg && (opinion || q.type === 'number')) body = <Results q={q} agg={reveal.agg} prev={reveal.prev} answer={q.type === 'number' ? reveal.a : null} />;
  else if (q.type === 'order') body = <ol className="answer-order">{(reveal?.a || []).map((i) => <li key={i}>{q.o[i]}</li>)}</ol>;
  else body = (
    <div className="dist">
      {q.o.map((o, i) => {
        const c = reveal?.dist?.[i] || 0;
        const right = !opinion && reveal?.a === i;
        return (
          <div key={i} className={`dbar ${right ? 'right' : ''}`}>
            <span className="mono">{LETTERS[i]}</span>
            <div className="tr"><i style={{ width: `${n ? (c * 100) / n : 0}%`, background: `var(--tile${LETTERS[i]})` }} /><span className="lbl">{o}</span></div>
            <span className="mono">{c}{right ? ' ✓' : ''}</span>
          </div>
        );
      })}
    </div>
  );
  return (
    <div className={`qcard reveal ${big ? 'big' : ''}`} ref={ref}>
      <div className="qhead"><RoundChip q={q} /><span className="chip">{TYPE_LABEL[q.type]}</span><span className="chip mono">{n} respuestas{!opinion ? ` · ${reveal?.okCount || 0} ${q.type === 'number' ? 'exactas' : 'correctas'}` : ''}</span></div>
      {head}
      <h2 className="qtext small">{q.q}</h2>
      {body}
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
