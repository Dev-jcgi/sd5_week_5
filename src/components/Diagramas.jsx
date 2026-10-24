import { useEffect, useRef, useState } from 'react';
import { dia, shapes } from '@joint/core';
import { animate, stagger } from 'animejs';

/* Diagramas interactivos (JointJS + anime.js): los estudiantes arrastran los nodos
   y simulan los flujos de la Semana 5. */

const C = { bg: '#141A22', line: '#2B3647', tx: '#EEF0E8', lime: '#C6F33A', org: '#FF8A3D', blu: '#6EA8FF', pur: '#B78CFF', bad: '#FF6B8B' };

const ESCENAS = {
  saga: {
    titulo: 'SAGA orquestada con compensaciones',
    nota: 'Arrastra los nodos para reacomodar el diagrama. Elige un escenario y observa los pasos y las compensaciones.',
    nodos: [
      ['orq', 'Orquestador', 380, 20, C.blu, 220],
      ['cre', 'Créditos', 40, 200, C.line], ['dig', 'Digester (IA)', 270, 200, C.line],
      ['cdn', 'CDN', 500, 200, C.line], ['not', 'Notifier', 730, 200, C.line],
      ['c-cre', 'Liberar créditos', 40, 380, C.org], ['c-dig', 'Descartar resultados', 270, 380, C.org],
      ['c-cdn', 'Borrar del CDN', 500, 380, C.org],
    ],
    links: [['orq', 'cre'], ['orq', 'dig'], ['orq', 'cdn'], ['orq', 'not'], ['cre', 'c-cre', true], ['dig', 'c-dig', true], ['cdn', 'c-cdn', true]],
    acciones: [
      ['Camino feliz', { falla: null }],
      ['Falla temporal en IA', { falla: null, temporal: 2 }],
      ['Falla en CDN', { falla: 'cdn' }],
      ['Falla en IA', { falla: 'dig' }],
    ],
  },
  outbox: {
    titulo: 'Outbox + CDC frente al dual write',
    nota: 'Compara qué pasa cuando el broker cae con y sin bandeja de salida. Luego reenvía un evento para ver la idempotencia.',
    nodos: [
      ['api', 'API', 20, 170, C.line], ['bd', 'BD · lotes', 250, 60, C.blu], ['ob', 'BD · outbox', 250, 280, C.blu],
      ['cdc', 'Relay / CDC', 500, 280, C.pur], ['bus', 'Broker', 730, 170, C.lime], ['nt', 'Notifier', 730, 380, C.line],
    ],
    links: [['api', 'bd'], ['api', 'ob'], ['api', 'bus'], ['ob', 'cdc'], ['cdc', 'bus'], ['bus', 'nt']],
    acciones: [
      ['Dual write (broker caído)', { modo: 'dual' }],
      ['Outbox + CDC', { modo: 'outbox' }],
      ['Reenviar (duplicado)', { modo: 'dup' }],
    ],
  },
};

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Diagramas() {
  const host = useRef(null);
  const ref = useRef({});
  const [escena, setEscena] = useState('saga');
  const [log, setLog] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const say = (t, color) => setLog((l) => [{ t, color, k: Math.random() }, ...l].slice(0, 9));

  useEffect(() => {
    const E = ESCENAS[escena];
    const graph = new dia.Graph({}, { cellNamespace: shapes });
    const el = document.createElement('div');
    host.current.appendChild(el);
    const paper = new dia.Paper({
      el, model: graph, cellViewNamespace: shapes, width: '100%', height: 500, gridSize: 10,
      background: { color: 'transparent' }, interactive: { linkMove: false, labelMove: false },
      defaultConnector: { name: 'rounded' }, defaultRouter: { name: 'normal' },
    });
    const nodos = {};
    for (const [id, label, x, y, stroke, w = 190] of E.nodos) {
      nodos[id] = new shapes.standard.Rectangle({
        position: { x, y }, size: { width: w, height: 70 },
        attrs: { body: { fill: C.bg, stroke, strokeWidth: 3, rx: 14, ry: 14, strokeDasharray: id.startsWith('c-') ? '8 6' : null },
          label: { text: label, fill: C.tx, fontSize: 17, fontWeight: 700, fontFamily: 'Space Grotesk, Arial, sans-serif' } },
      });
    }
    graph.addCells(Object.values(nodos));
    const links = {};
    for (const [a, b, comp] of E.links) {
      links[`${a}>${b}`] = new shapes.standard.Link({
        source: { id: nodos[a].id }, target: { id: nodos[b].id },
        attrs: { line: { stroke: comp ? C.org : C.line, strokeWidth: 3, strokeDasharray: comp ? '6 6' : null, opacity: comp ? 0.25 : 1,
          targetMarker: { type: 'path', d: 'M 10 -5 0 0 10 5 z', fill: comp ? C.org : C.line } } },
      });
    }
    graph.addCells(Object.values(links));
    const token = new shapes.standard.Circle({ size: { width: 22, height: 22 }, position: { x: -100, y: -100 },
      attrs: { body: { fill: C.lime, stroke: 'none', filter: { name: 'dropShadow', args: { dx: 0, dy: 0, blur: 6, color: C.lime } } } } });
    token.set('z', 99);
    graph.addCell(token);
    const fit = () => paper.transformToFitContent({ padding: 24, maxScale: 1.25, horizontalAlign: 'middle', verticalAlign: 'middle' });
    fit();
    window.addEventListener('resize', fit);
    ref.current = { graph, paper, nodos, links, token };
    // Entrada animada de los nodos (anime.js sobre los <g> del SVG).
    const vistas = Object.values(nodos).map((n) => paper.findViewByModel(n)?.el).filter(Boolean);
    animate(vistas, { opacity: [0, 1], duration: 600, delay: stagger(80), ease: 'outExpo' });
    setLog([]);
    return () => { window.removeEventListener('resize', fit); paper.remove(); };
  }, [escena]);

  /* ---------- utilidades de animación ---------- */
  const pinta = (id, stroke, fill = C.bg) => ref.current.nodos[id].attr({ body: { stroke, fill } });
  const recorre = (a, b, color = C.lime, ms = 750) => new Promise((ok) => {
    const { paper, links, token } = ref.current;
    const link = links[`${a}>${b}`]; if (!link) return ok();
    const lv = paper.findViewByModel(link);
    token.attr('body/fill', color); token.attr('body/filter/args/color', color);
    const o = { t: 0 };
    animate(o, { t: 1, duration: ms, ease: 'inOutQuad', onUpdate: () => { const p = lv.getPointAtRatio(o.t); token.position(p.x - 11, p.y - 11); }, onComplete: () => ok() });
  });
  // Pulso del borde: se anima un objeto y se aplica como atributo (no se toca el transform del <g>).
  const latido = (id) => { const n = ref.current.nodos[id]; const o = { w: 3 }; animate(o, { w: [3, 10, 3], duration: 650, ease: 'outQuad', onUpdate: () => n.attr('body/strokeWidth', o.w) }); };
  const reset = () => {
    const E = ESCENAS[escena];
    for (const [id, , , , stroke] of E.nodos) pinta(id, stroke);
    for (const [a, b, comp] of E.links) if (comp) ref.current.links[`${a}>${b}`].attr('line/opacity', 0.25);
    ref.current.token.position(-100, -100);
  };

  async function correrSaga({ falla, temporal = 0 }) {
    const pasos = ['cre', 'dig', 'cdn', 'not'];
    const nombre = { cre: 'Créditos reservados', dig: 'Imágenes procesadas', cdn: 'Publicado en CDN', not: 'Usuario notificado' };
    const hechos = [];
    for (const p of pasos) {
      if (p === 'dig' && temporal) {
        for (let i = 1; i <= temporal; i++) {
          await recorre('orq', p, C.blu); pinta(p, C.org); say(`IA ocupada (503), intento ${i}: reintento con backoff ${i} s`, C.org);
          await espera(500 * i);
        }
      }
      await recorre('orq', p, C.blu);
      if (p === falla) {
        pinta(p, C.bad, '#3A1620'); latido(p);
        say(`${p === 'cdn' ? 'El CDN no responde' : 'Formato inválido en la IA'}: falla permanente → compensar`, C.bad);
        await espera(700);
        for (const h of [...hechos].reverse()) {
          if (!ref.current.links[`${h}>c-${h}`]) continue;
          ref.current.links[`${h}>c-${h}`].attr('line/opacity', 1);
          await recorre(h, `c-${h}`, C.org); pinta(`c-${h}`, C.org, '#2A1A10'); latido(`c-${h}`);
          say(`Compensación: ${ref.current.nodos[`c-${h}`].attr('label/text')}`, C.org);
        }
        say('Resultado: COMPENSADO (sin 2PC ni bloqueos)', C.org);
        return;
      }
      pinta(p, C.lime); latido(p); hechos.push(p); say(nombre[p], C.lime);
    }
    say('Resultado: COMPLETADO', C.lime);
  }

  async function correrOutbox({ modo }) {
    if (modo === 'dual') {
      await recorre('api', 'bd'); pinta('bd', C.lime); say('Lote guardado en la BD (COMMIT)', C.lime);
      pinta('bus', C.bad, '#3A1620'); latido('bus');
      await recorre('api', 'bus', C.bad, 900); say('El broker está caído: el evento se PERDIÓ. Lote huérfano.', C.bad);
      return;
    }
    if (modo === 'outbox') {
      await recorre('api', 'bd'); await recorre('api', 'ob');
      pinta('bd', C.lime); pinta('ob', C.lime); say('Lote + evento en UNA transacción (outbox: pendiente)', C.lime);
      pinta('bus', C.bad, '#3A1620'); say('El broker sigue caído… el evento espera seguro en la outbox', C.bad);
      await espera(1400); pinta('bus', C.lime); latido('bus'); say('El broker volvió', C.lime);
      await recorre('ob', 'cdc', C.pur); pinta('cdc', C.pur); say('El relay/CDC lee la outbox', C.pur);
      await recorre('cdc', 'bus'); await recorre('bus', 'nt'); pinta('nt', C.lime); latido('nt');
      say('Publicado y consumido; outbox marcada como enviada', C.lime);
      return;
    }
    await recorre('cdc', 'bus', C.org); await recorre('bus', 'nt', C.org); latido('nt');
    say('Mismo messageId otra vez: el Notifier lo ignora (idempotencia)', C.org);
  }

  const correr = async (opts) => {
    if (ocupado) return;
    setOcupado(true); reset(); setLog([]);
    try { await (escena === 'saga' ? correrSaga(opts) : correrOutbox(opts)); } finally { setOcupado(false); }
  };

  const E = ESCENAS[escena];
  return (
    <div className="page wrap diag">
      <p className="eyebrow">Diagramas interactivos · Semana 5</p>
      <h1 className="h-lg">{E.titulo}</h1>
      <p className="exp">{E.nota}</p>
      <div className="row-btns">
        {Object.entries(ESCENAS).map(([k, v]) => (
          <button key={k} className={`btn ${k === escena ? '' : 'ghost'}`} onClick={() => !ocupado && setEscena(k)}>{k === 'saga' ? 'SAGA' : 'Outbox + CDC'}</button>
        ))}
      </div>
      <div className="diag-grid">
        <div className="diag-paper" ref={host} aria-label={`Diagrama: ${E.titulo}`} />
        <aside className="diag-log">
          <p className="eyebrow">Simular</p>
          <div className="diag-actions">
            {E.acciones.map(([t, o]) => <button key={t} className="btn ghost" disabled={ocupado} onClick={() => correr(o)}>{t}</button>)}
          </div>
          <p className="eyebrow">Bitácora</p>
          {log.map((l) => <p key={l.k} className="diag-line" style={{ borderColor: l.color }}>{l.t}</p>)}
          {!log.length && <p className="note">Elige un escenario.</p>}
        </aside>
      </div>
    </div>
  );
}
