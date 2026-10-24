// DEMO 2 · Bandeja de salida (Transactional Outbox) + CDC con Cosmos DB y Service Bus.
//
//   POST /api/outbox/dual-write        { caeBroker: true }  → el PROBLEMA: guardar y publicar por separado
//   POST /api/outbox/lotes             { imagenes: 3 }      → la SOLUCIÓN: lote + evento en UNA transacción
//   GET  /api/outbox/lotes/{id}                             → ver el lote y su outbox (enviado: true/false)
//   POST /api/outbox/lotes/{id}/estado { estado }           → cambio "legado" sin evento: lo detecta el CDC
//   POST /api/outbox/lotes/{id}/reenviar                    → simula que el relay publicó dos veces
//
//   cdcRelay  (Change Feed de Cosmos = CDC) → lee la outbox, publica en Service Bus y marca enviado
//   notifier  (Service Bus queue)           → consumidor IDEMPOTENTE: ignora duplicados
const { app } = require('@azure/functions');
const { randomUUID } = require('node:crypto');
const { cosmos, serviceBus, hay, bitacora } = require('../lib/clientes');
const { crearEvento } = require('../lib/eventos');
const { primeraVez } = require('../lib/idempotencia');

const COLA = 'pixpro-eventos';
const json = (status, body) => ({ status, jsonBody: body });
let sender = null;
const enviar = (evento) => {
  sender ||= serviceBus().createSender(COLA);
  return sender.sendMessages({
    body: evento,
    messageId: evento.id,               // misma id = mismo evento (clave de idempotencia)
    correlationId: evento.correlationId,
    subject: evento.type,
    contentType: 'application/json',
    applicationProperties: { type: evento.type, schemaVersion: evento.schemaVersion },
  });
};

/* ---------- el problema: dual write ---------- */
async function dualWrite(req, ctx) {
  const { caeBroker = true } = await req.json().catch(() => ({}));
  const loteId = 'dw-' + randomUUID().slice(0, 8);
  await cosmos().items.create({ id: loteId, loteId, tipo: 'lote', estado: 'recibido', imagenes: 3 });
  await bitacora(ctx, 'OUTBOX', `dual write: ${loteId} guardado en la BD`);
  if (caeBroker) {
    await bitacora(ctx, 'OUTBOX', `dual write: el broker "se cayó" → LoteCreado de ${loteId} se PERDIÓ`);
    return json(500, { loteId, problema: 'El lote existe en la BD pero nadie se enteró: el evento nunca se publicó. Nadie lo procesará.' });
  }
  await enviar(crearEvento('LoteCreado', { loteId, imagenes: 3 }, { aggregateId: loteId }));
  return json(202, { loteId, nota: 'Esta vez funcionó… pero solo porque el broker estaba arriba.' });
}

/* ---------- la solución: outbox en la misma transacción ---------- */
async function crearLote(req, ctx) {
  const body = await req.json().catch(() => ({}));
  const loteId = body.loteId || 'lote-' + randomUUID().slice(0, 8);
  const evento = crearEvento('LoteCreado', { loteId, imagenes: body.imagenes || 3, filtros: body.filtros || ['sepia'] }, { aggregateId: loteId });
  // Mismo valor de partición (/loteId) → Cosmos permite una TransactionalBatch atómica.
  const r = await cosmos().items.batch([
    { operationType: 'Create', resourceBody: { id: loteId, loteId, tipo: 'lote', estado: 'recibido', imagenes: evento.data.imagenes } },
    { operationType: 'Create', resourceBody: { id: evento.id, loteId, tipo: 'outbox', enviado: false, evento } },
  ], loteId);
  const ok = (r.result || []).every((x) => x.statusCode < 400);
  if (!ok) return json(500, { error: 'La transacción falló completa: ni lote ni evento', detalle: r.result });
  await bitacora(ctx, 'OUTBOX', `${loteId}: lote + evento ${evento.type} guardados en UNA transacción (enviado=false)`);
  return json(202, { loteId, eventoId: evento.id, nota: 'Mira la bitácora: el CDC lo publicará en segundos' });
}

async function verLote(req) {
  const loteId = req.params.id;
  const { resources } = await cosmos().items.query({ query: 'SELECT * FROM c WHERE c.loteId = @l', parameters: [{ name: '@l', value: loteId }] }, { partitionKey: loteId }).fetchAll();
  return json(200, { lote: resources.find((d) => d.tipo === 'lote') || null, outbox: resources.filter((d) => d.tipo === 'outbox').map((d) => ({ id: d.id, type: d.evento.type, enviado: d.enviado, enviadoEn: d.enviadoEn })) });
}

async function cambiarEstado(req, ctx) {
  const loteId = req.params.id;
  const { estado = 'procesando' } = await req.json().catch(() => ({}));
  await cosmos().item(loteId, loteId).patch([{ op: 'set', path: '/estado', value: estado }]);
  await bitacora(ctx, 'CDC', `${loteId}: una app "legada" cambió estado → ${estado} (sin publicar nada)`);
  return json(200, { loteId, estado, nota: 'El Change Feed lo convertirá en evento' });
}

async function reenviar(req, ctx) {
  const loteId = req.params.id;
  const { resources } = await cosmos().items.query({ query: "SELECT * FROM c WHERE c.loteId = @l AND c.tipo = 'outbox'", parameters: [{ name: '@l', value: loteId }] }, { partitionKey: loteId }).fetchAll();
  for (const d of resources) await enviar(d.evento);
  await bitacora(ctx, 'OUTBOX', `${loteId}: relay reenvió ${resources.length} evento(s) (duplicado a propósito)`);
  return json(202, { reenviados: resources.length });
}

/* ---------- CDC: Change Feed de Cosmos ---------- */
async function cdcRelay(documentos, ctx) {
  for (const d of documentos) {
    if (d.tipo === 'outbox' && !d.enviado) {
      await enviar(d.evento);
      await cosmos().item(d.id, d.loteId).patch([{ op: 'set', path: '/enviado', value: true }, { op: 'set', path: '/enviadoEn', value: new Date().toISOString() }]);
      await bitacora(ctx, 'CDC', `relay: ${d.evento.type} de ${d.loteId} publicado en ${COLA} y marcado enviado=true`);
    } else if (d.tipo === 'lote' && d.id.startsWith('lote-')) {
      // CDC "puro": el cambio de una fila se vuelve evento aunque la app no lo emitió.
      const ev = crearEvento('cdc.LoteActualizado', { loteId: d.loteId, estado: d.estado }, { aggregateId: d.loteId, source: 'pixpro/cdc', id: `${d.id}-${d._etag}`.replace(/"/g, '') });
      await enviar(ev);
      await bitacora(ctx, 'CDC', `change feed vio ${d.loteId} con estado=${d.estado} → publicó ${ev.type}`);
    }
  }
}

/* ---------- consumidor idempotente ---------- */
async function notifier(mensaje, ctx) {
  const id = ctx.triggerMetadata?.messageId;
  const evento = typeof mensaje === 'string' ? JSON.parse(mensaje) : mensaje;
  if (!(await primeraVez('notifier', id))) {
    await bitacora(ctx, 'NOTIFIER', `DUPLICADO ignorado: ${evento.type} (${String(id).slice(0, 8)}…)`);
    return;
  }
  await bitacora(ctx, 'NOTIFIER', `procesado ${evento.type} de ${evento.data?.loteId} → "tu lote cambió" (WebSocket simulado)`);
}

app.http('outboxDualWrite', { methods: ['POST'], authLevel: 'anonymous', route: 'outbox/dual-write', handler: dualWrite });
app.http('outboxCrearLote', { methods: ['POST'], authLevel: 'anonymous', route: 'outbox/lotes', handler: crearLote });
app.http('outboxVerLote', { methods: ['GET'], authLevel: 'anonymous', route: 'outbox/lotes/{id}', handler: verLote });
app.http('outboxCambiarEstado', { methods: ['POST'], authLevel: 'anonymous', route: 'outbox/lotes/{id}/estado', handler: cambiarEstado });
app.http('outboxReenviar', { methods: ['POST'], authLevel: 'anonymous', route: 'outbox/lotes/{id}/reenviar', handler: reenviar });

// Los disparadores solo se registran si existen las conexiones (así la Demo 1 y 3 corren sin Azure).
if (hay.cosmos() && hay.serviceBus()) {
  app.cosmosDB('cdcRelay', {
    connection: 'CosmosDBConnection', databaseName: 'pixpro', containerName: 'lotes',
    leaseContainerName: 'leases', createLeaseContainerIfNotExists: true, handler: cdcRelay,
  });
}
if (hay.serviceBus()) {
  app.serviceBusQueue('notifier', { connection: 'ServiceBusConnection', queueName: COLA, handler: notifier });
}

module.exports = { dualWrite, crearLote, verLote, cambiarEstado, reenviar, cdcRelay, notifier };
