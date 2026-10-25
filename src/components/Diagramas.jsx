import { useEffect, useRef, useState } from 'react';
import { dia, shapes } from '@joint/core';
import { animate, stagger } from 'animejs';

/* Diagramas interactivos (JointJS + anime.js): los estudiantes arrastran los nodos
   y simulan los flujos de la Semana 5. */

const C = { bg: '#141A22', line: '#2B3647', tx: '#EEF0E8', lime: '#C6F33A', org: '#FF8A3D', blu: '#6EA8FF', pur: '#B78CFF', bad: '#FF6B8B' };

const ESCENAS = {
  saga: {
    titulo: 'SAGA orquestada con compensaciones',
    tab: '2 · SAGA',
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
    tab: '2 · Outbox + CDC',
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
  es: {
    titulo: 'Event Sourcing: guardar eventos y reproducirlos',
    nota: 'Agrega eventos al log y luego reconstruye las vistas con un replay, desde cero o desde un snapshot.',
    tab: '1 · Event Sourcing',
    nodos: [
      ['api', 'API (comandos)', 20, 180, C.line], ['log', 'Event store · lote_481', 280, 180, C.lime, 240],
      ['snap', 'Snapshot v4', 300, 20, C.pur], ['saldo', 'Vista: saldo', 640, 80, C.blu], ['hist', 'Vista: historial', 640, 290, C.blu],
    ],
    links: [['api', 'log'], ['log', 'saldo'], ['log', 'hist'], ['log', 'snap', true]],
    acciones: [['Agregar evento', { modo: 'add' }], ['Replay desde cero', { modo: 'replay' }], ['Replay desde snapshot', { modo: 'snap' }]],
  },
  coord: {
    titulo: 'Orquestación frente a coreografía',
    nota: 'El mismo flujo de PixPro coordinado por un director central o por eventos entre servicios.',
    tab: '3 · Coordinar',
    nodos: [
      ['orq', 'Orquestador', 330, 10, C.blu, 220],
      ['cre', 'Créditos', 20, 220, C.line], ['dig', 'Digester (IA)', 250, 220, C.line], ['cdn', 'CDN', 480, 220, C.line], ['not', 'Notifier', 710, 220, C.line],
    ],
    links: [['orq', 'cre'], ['orq', 'dig'], ['orq', 'cdn'], ['orq', 'not'], ['cre', 'dig', true], ['dig', 'cdn', true], ['cdn', 'not', true]],
    acciones: [['Orquestación', { modo: 'orq' }], ['Coreografía', { modo: 'coreo' }], ['Coreografía: ¿quién falló?', { modo: 'coreoFalla' }]],
  },
  part: {
    titulo: 'Particiones y hotspots',
    nota: 'La clave de partición decide a qué carril va cada evento. Compara userId (una agencia sube el 40 %) contra loteId.',
    tab: '4 · Particiones',
    nodos: [
      ['prod', 'Productor', 20, 200, C.line],
      ['p0', 'Partición 0', 330, 20, C.line], ['p1', 'Partición 1', 330, 140, C.line], ['p2', 'Partición 2', 330, 260, C.line], ['p3', 'Partición 3', 330, 380, C.line],
      ['c0', 'Consumidor 0', 640, 20, C.blu], ['c1', 'Consumidor 1', 640, 140, C.blu], ['c2', 'Consumidor 2', 640, 260, C.blu], ['c3', 'Consumidor 3', 640, 380, C.blu],
    ],
    links: [['prod', 'p0'], ['prod', 'p1'], ['prod', 'p2'], ['prod', 'p3'], ['p0', 'c0'], ['p1', 'c1'], ['p2', 'c2'], ['p3', 'c3']],
    acciones: [['Clave = userId', { modo: 'user' }], ['Clave = loteId', { modo: 'lote' }]],
  },
  cap: {
    titulo: 'CAP: la red se parte',
    nota: 'Dos nodos replican la misma foto. Corta la red y elige: responder con un dato viejo (AP) o devolver un error (CP).',
    tab: '5 · CAP',
    nodos: [
      ['ua', 'Usuario A', 20, 200, C.line], ['g1', 'Nodo G1 · v0', 260, 200, C.blu], ['g2', 'Nodo G2 · v0', 560, 200, C.blu], ['ub', 'Usuario B', 800, 200, C.line],
    ],
    links: [['ua', 'g1'], ['g1', 'g2'], ['ub', 'g2']],
    acciones: [['Red normal', { modo: 'ok' }], ['Partición · AP', { modo: 'ap' }], ['Partición · CP', { modo: 'cp' }]],
  },
};

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Diagramas() {
  const host = useRef(null);
  const ref = useRef({});
  const [escena, setEscena] = useState(() => { const e = new URLSearchParams(location.hash.split('?')[1] || '').get('e'); return ESCENAS[e] ? e : 'es'; });
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
    ref.current = { graph, paper, nodos, links, token, ev: 4 };
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
    for (const [id, label, , , stroke] of E.nodos) { pinta(id, stroke); ref.current.nodos[id].attr('label/text', label); }
    if (escena === 'cap') { ref.current.links['g1>g2'].attr('line/stroke', C.line); ref.current.links['g1>g2'].attr('line/strokeDasharray', null); }
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


  async function correrEs({ modo }) {
    const R = ref.current;
    R.ev = R.ev || 4;
    if (modo === 'add') {
      await recorre('api', 'log'); R.ev++; latido('log');
      R.nodos.log.attr('label/text', `Event store · ${R.ev} eventos`); say(`Evento v${R.ev} agregado al final del log (nunca se edita)`, C.lime); return;
    }
    const desde = modo === 'snap' ? 4 : 0;
    if (modo === 'snap') { await recorre('log', 'snap', C.pur); pinta('snap', C.pur); say('Se carga el snapshot de la versión 4', C.pur); }
    for (let v = desde + 1; v <= R.ev; v++) { latido('log'); say(`Aplicando v${v}…`, C.blu); await espera(350); }
    await Promise.all([recorre('log', 'saldo', C.blu), recorre('log', 'hist', C.blu)]);
    pinta('saldo', C.lime); pinta('hist', C.lime); latido('saldo'); latido('hist');
    const k = R.ev - desde;
    say(`Vistas reconstruidas aplicando ${k} evento${k === 1 ? '' : 's'}${modo === 'snap' ? ' (en vez de ' + R.ev + ')' : ''}`, C.lime);
  }
  async function correrCoord({ modo }) {
    const pasos = ['cre', 'dig', 'cdn', 'not'];
    const nombre = { cre: 'Créditos', dig: 'Digester', cdn: 'CDN', not: 'Notifier' };
    if (modo === 'orq') {
      for (const p of pasos) { await recorre('orq', p, C.blu); pinta(p, C.lime); latido(p); say(`Orquestador → ${nombre[p]}: “haz tu paso”`, C.blu); }
      say('Todo el flujo está escrito en un solo lugar: fácil de seguir', C.lime); return;
    }
    for (const [a, b, comp] of ESCENAS.coord.links) if (comp) ref.current.links[`${a}>${b}`].attr('line/opacity', 1);
    pinta('cre', C.lime); latido('cre'); say('Créditos publica CreditosReservados', C.org);
    for (let i = 0; i < 3; i++) {
      const [a, b] = [pasos[i], pasos[i + 1]];
      await recorre(a, b, C.org);
      if (modo === 'coreoFalla' && b === 'cdn') { pinta('cdn', C.bad, '#3A1620'); latido('cdn'); say('El CDN falló en silencio… ¿quién se entera? Nadie tiene la vista completa', C.bad); return; }
      pinta(b, C.lime); latido(b); say(`${nombre[b]} reaccionó al evento de ${nombre[a]}`, C.org);
    }
    say('Nadie dirige: cada servicio reacciona. Más desacoplado, más difícil de rastrear', C.lime);
  }
  async function correrPart({ modo }) {
    const carga = [0, 0, 0, 0];
    for (let i = 0; i < 12; i++) {
      const p = modo === 'user' ? (i % 10 < 6 ? 1 : [0, 2, 3][i % 3]) : i % 4;
      carga[p]++;
      await recorre('prod', `p${p}`, modo === 'user' && p === 1 ? C.bad : C.lime, 260);
      const caliente = carga[p] >= 5;
      pinta(`p${p}`, caliente ? C.bad : C.lime, caliente ? '#3A1620' : C.bg);
      ref.current.nodos[`p${p}`].attr('label/text', `Partición ${p} · ${carga[p]}`);
    }
    say(modo === 'user' ? `Hotspot: la partición 1 recibió ${carga[1]} de 12 eventos; su consumidor se satura` : 'loteId reparte 3 eventos por partición y cada lote conserva su orden', modo === 'user' ? C.bad : C.lime);
    for (let p = 0; p < 4; p++) if (carga[p]) recorre(`p${p}`, `c${p}`, C.blu, 400);
  }
  async function correrCap({ modo }) {
    const n = ref.current.nodos;
    n.g1.attr('label/text', 'Nodo G1 · v0'); n.g2.attr('label/text', 'Nodo G2 · v0');
    const red = ref.current.links['g1>g2'];
    red.attr('line/stroke', C.line); red.attr('line/strokeDasharray', null);
    await recorre('ua', 'g1'); n.g1.attr('label/text', 'Nodo G1 · v1'); pinta('g1', C.lime); say('A sube la foto v1 al nodo G1', C.lime);
    if (modo === 'ok') {
      await recorre('g1', 'g2', C.blu); n.g2.attr('label/text', 'Nodo G2 · v1'); pinta('g2', C.lime);
      await recorre('ub', 'g2'); say('Sin partición: B lee v1. Consistente y disponible', C.lime); return;
    }
    red.attr('line/stroke', C.bad); red.attr('line/strokeDasharray', '4 8'); latido('g2');
    say('✕ Se cortó la red entre G1 y G2', C.bad); await espera(900);
    await recorre('ub', 'g2', C.blu);
    if (modo === 'ap') { pinta('g2', C.org); latido('g2'); say('AP: G2 responde v0 (viejo). Disponible, pero inconsistente', C.org); }
    else { pinta('g2', C.bad, '#3A1620'); latido('g2'); say('CP: G2 responde error hasta recuperar la red. Consistente, pero no disponible', C.bad); }
  }

  const correr = async (opts) => {
    if (ocupado) return;
    setOcupado(true); reset(); setLog([]);
    try { await ({ saga: correrSaga, outbox: correrOutbox, es: correrEs, coord: correrCoord, part: correrPart, cap: correrCap }[escena])(opts); } finally { setOcupado(false); }
  };

  const E = ESCENAS[escena];
  return (
    <div className="page wrap diag">
      <p className="eyebrow">Diagramas interactivos · Semana 5</p>
      <h1 className="h-lg">{E.titulo}</h1>
      <p className="exp">{E.nota}</p>
      <div className="row-btns">
        {['es', 'outbox', 'saga', 'coord', 'part', 'cap'].map((k) => [k, ESCENAS[k]]).map(([k, v]) => (
          <button key={k} className={`btn ${k === escena ? '' : 'ghost'}`} onClick={() => !ocupado && setEscena(k)}>{v.tab}</button>
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
