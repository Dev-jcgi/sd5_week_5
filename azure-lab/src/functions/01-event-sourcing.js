// DEMO 1 · Almacenar y reproducir eventos (Event Sourcing) con Table Storage.
//
//   POST /api/es/lotes/{id}/eventos   { type, data, expectedVersion }  → agrega un evento
//   GET  /api/es/lotes/{id}           ?hasta=N                          → reconstruye el estado (replay)
//   GET  /api/es/lotes/{id}/historial                                   → estado después de cada evento
//   POST /api/es/lotes/{id}/snapshot                                    → guarda una foto del estado
//   POST /api/es/lotes/{id}/demo                                        → carga 6 eventos de ejemplo
const { app } = require('@azure/functions');
const store = require('../lib/event-store');
const { reconstruir, historial, validar } = require('../lib/lote');
const { crearEvento } = require('../lib/eventos');
const { bitacora } = require('../lib/clientes');

const json = (status, body) => ({ status, jsonBody: body });

async function estadoActual(id) {
  const snap = await store.leerSnapshot(id);
  const eventos = await store.leer(id, snap ? snap.version : 0);
  return { ...reconstruir(id, eventos, { desde: snap }), desdeSnapshot: snap ? snap.version : null };
}

async function agregarEvento(req, ctx) {
  const id = req.params.id;
  const body = await req.json().catch(() => ({}));
  const { estado } = await estadoActual(id);
  const expected = Number.isInteger(body.expectedVersion) ? body.expectedVersion : estado.version;
  const error = validar(estado, body.type);
  if (error) return json(400, { error, estado });
  try {
    const ev = await store.agregar(id, crearEvento(body.type, body.data, { aggregateId: id, correlationId: body.correlationId }), expected);
    await bitacora(ctx, 'ES', `${id} v${ev.version} ← ${ev.type}`);
    return json(201, { evento: ev });
  } catch (e) {
    if (e.status === 409) {
      await bitacora(ctx, 'ES', `${id}: conflicto de concurrencia optimista (esperaba v${expected})`);
      return json(409, { error: e.message, pista: 'Vuelve a leer el lote y reintenta con la versión nueva' });
    }
    throw e;
  }
}

async function reconstruirLote(req, ctx) {
  const id = req.params.id;
  const hasta = req.query.get('hasta');
  const t0 = Date.now();
  let r;
  if (hasta) {
    r = { ...reconstruir(id, await store.leer(id), { hasta: Number(hasta) }), desdeSnapshot: null };
  } else {
    r = await estadoActual(id);
  }
  await bitacora(ctx, 'ES', `replay de ${id}: ${r.aplicados} eventos aplicados${r.desdeSnapshot ? ` desde snapshot v${r.desdeSnapshot}` : ''}${hasta ? ` hasta v${hasta}` : ''}`);
  return json(200, { ...r, ms: Date.now() - t0 });
}

async function verHistorial(req) {
  const id = req.params.id;
  return json(200, { lote: id, pasos: historial(id, await store.leer(id)) });
}

async function tomarSnapshot(req, ctx) {
  const id = req.params.id;
  const { estado } = await estadoActual(id);
  await store.guardarSnapshot(id, estado);
  await bitacora(ctx, 'ES', `snapshot de ${id} en v${estado.version}`);
  return json(200, { snapshot: estado });
}

async function cargarDemo(req, ctx) {
  const id = req.params.id;
  const guion = [
    ['LoteCreado', { imagenes: 3, filtros: ['sepia', 'resize'] }],
    ['CreditosReservados', { creditos: 3 }],
    ['ImagenProcesada', { imagenId: 'img_1' }],
    ['ImagenFallida', { imagenId: 'img_2', motivo: 'formato no soportado' }],
    ['ImagenProcesada', { imagenId: 'img_3' }],
    ['LoteCompletado', {}],
  ];
  let { estado } = await estadoActual(id);
  if (estado.version > 0) return json(409, { error: `El lote ${id} ya tiene eventos; usa otro id` });
  const corr = `demo-${id}`;
  for (const [type, data] of guion) {
    await store.agregar(id, crearEvento(type, data, { aggregateId: id, correlationId: corr }), estado.version);
    estado = { version: estado.version + 1 };
  }
  await bitacora(ctx, 'ES', `${id}: cargados ${guion.length} eventos de ejemplo`);
  return reconstruirLote({ params: { id }, query: new URLSearchParams() }, ctx);
}

app.http('esAgregarEvento', { methods: ['POST'], authLevel: 'anonymous', route: 'es/lotes/{id}/eventos', handler: agregarEvento });
app.http('esReconstruir', { methods: ['GET'], authLevel: 'anonymous', route: 'es/lotes/{id}', handler: reconstruirLote });
app.http('esHistorial', { methods: ['GET'], authLevel: 'anonymous', route: 'es/lotes/{id}/historial', handler: verHistorial });
app.http('esSnapshot', { methods: ['POST'], authLevel: 'anonymous', route: 'es/lotes/{id}/snapshot', handler: tomarSnapshot });
app.http('esDemo', { methods: ['POST'], authLevel: 'anonymous', route: 'es/lotes/{id}/demo', handler: cargarDemo });

module.exports = { agregarEvento, reconstruirLote, verHistorial, tomarSnapshot, cargarDemo };
