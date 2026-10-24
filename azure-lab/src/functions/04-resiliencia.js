// DEMO 4 · Manejo de errores: reintentos con backoff, circuit breaker y Dead Letter Queue.
//
//   POST /api/resiliencia/ia/{modo}       modo = ok | intermitente | caida   → cómo se comporta la "IA externa"
//   POST /api/resiliencia/procesar                                          → llamada con reintento + circuit breaker
//   POST /api/resiliencia/trabajos   { veneno: true|false }                 → mensaje a la cola pixpro-trabajos
//   GET  /api/resiliencia/dlq                                               → ver la Dead Letter Queue
//   POST /api/resiliencia/dlq/reprocesar                                    → corregir y devolver a la cola
//
//   digester (Service Bus queue): si el mensaje es "veneno" lanza error; Service Bus lo
//   reintenta (maxDeliveryCount = 3) y después lo mueve SOLO a la DLQ.
const { app } = require('@azure/functions');
const { reintentar, CircuitBreaker } = require('../lib/resiliencia');
const { serviceBus, hay, bitacora } = require('../lib/clientes');

const COLA = 'pixpro-trabajos';
let modoIA = 'ok';
let llamada = 0;
const breaker = new CircuitBreaker({ umbral: 3, enfriamientoMs: 15000 });

/** IA externa falsa: ok · intermitente (falla 2 de cada 3) · caída (siempre 503). */
async function iaExterna() {
  llamada++;
  await new Promise((r) => setTimeout(r, 120));
  if (modoIA === 'caida' || (modoIA === 'intermitente' && llamada % 3 !== 0)) throw new Error('IA respondió 503');
  return { etiquetas: ['perro', 'parque'], llamada };
}

async function cambiarModo(req, ctx) {
  modoIA = ['ok', 'intermitente', 'caida'].includes(req.params.modo) ? req.params.modo : 'ok';
  llamada = 0;
  await bitacora(ctx, 'RESIL', `IA externa ahora está: ${modoIA}`);
  return { jsonBody: { modoIA, breaker: breaker.info() } };
}

async function procesar(req, ctx) {
  const r = await reintentar(() => breaker.ejecutar(iaExterna), { intentos: 4, baseMs: 250 });
  const resumen = r.bitacora.map((b) => (b.resultado === 'ok' ? `#${b.intento} ok` : `#${b.intento} ✗ ${b.error}${b.espera ? ` → espera ${b.espera} ms` : ''}`)).join(' | ');
  await bitacora(ctx, 'RESIL', `${r.ok ? 'ÉXITO' : 'FALLO'} · ${resumen} · circuito ${breaker.estado}`);
  return { status: r.ok ? 200 : 503, jsonBody: { ...r, breaker: breaker.info(), fallback: r.ok ? undefined : 'Guardar el lote como "pendiente de IA" y reintentarlo más tarde' } };
}

let sender = null;
async function encolar(req, ctx) {
  const { veneno = false } = await req.json().catch(() => ({}));
  sender ||= serviceBus().createSender(COLA);
  const trabajo = { trabajoId: 'job-' + Date.now().toString(36), imagen: veneno ? 'archivo-corrupto.xyz' : 'foto.jpg', veneno };
  await sender.sendMessages({ body: trabajo, messageId: trabajo.trabajoId, subject: 'ProcesarImagen' });
  await bitacora(ctx, 'DLQ', `encolado ${trabajo.trabajoId} (${veneno ? 'VENENO' : 'normal'})`);
  return { status: 202, jsonBody: trabajo };
}

async function digester(trabajo, ctx) {
  const intento = ctx.triggerMetadata?.deliveryCount;
  if (trabajo.veneno) {
    await bitacora(ctx, 'DLQ', `digester: ${trabajo.trabajoId} falló (entrega ${intento} de 3)${intento >= 3 ? ' → Service Bus lo manda a la DLQ' : ''}`);
    throw new Error('Imagen corrupta: no se puede procesar');
  }
  await bitacora(ctx, 'DLQ', `digester: ${trabajo.trabajoId} procesado (entrega ${intento})`);
}

async function verDlq() {
  const rec = serviceBus().createReceiver(COLA, { subQueueType: 'deadLetter' });
  try {
    const msgs = await rec.peekMessages(20);
    return { jsonBody: msgs.map((m) => ({ id: m.messageId, motivo: m.deadLetterReason, detalle: m.deadLetterErrorDescription, entregas: m.deliveryCount, body: m.body })) };
  } finally { await rec.close(); }
}

async function reprocesarDlq(req, ctx) {
  const rec = serviceBus().createReceiver(COLA, { subQueueType: 'deadLetter' });
  sender ||= serviceBus().createSender(COLA);
  let n = 0;
  try {
    const msgs = await rec.receiveMessages(20, { maxWaitTimeInMs: 3000 });
    for (const m of msgs) {
      const arreglado = { ...m.body, veneno: false, imagen: 'foto-reparada.jpg', reprocesado: true };
      await sender.sendMessages({ body: arreglado, messageId: m.messageId + '-r', subject: 'ProcesarImagen' });
      await rec.completeMessage(m);
      n++;
    }
  } finally { await rec.close(); }
  await bitacora(ctx, 'DLQ', `reprocesados ${n} mensaje(s) desde la DLQ tras corregirlos`);
  return { jsonBody: { reprocesados: n } };
}

app.http('resilModoIA', { methods: ['POST'], authLevel: 'anonymous', route: 'resiliencia/ia/{modo}', handler: cambiarModo });
app.http('resilProcesar', { methods: ['POST'], authLevel: 'anonymous', route: 'resiliencia/procesar', handler: procesar });
app.http('resilEncolar', { methods: ['POST'], authLevel: 'anonymous', route: 'resiliencia/trabajos', handler: encolar });
app.http('resilVerDlq', { methods: ['GET'], authLevel: 'anonymous', route: 'resiliencia/dlq', handler: verDlq });
app.http('resilReprocesarDlq', { methods: ['POST'], authLevel: 'anonymous', route: 'resiliencia/dlq/reprocesar', handler: reprocesarDlq });
if (hay.serviceBus()) app.serviceBusQueue('digester', { connection: 'ServiceBusConnection', queueName: COLA, handler: digester });

module.exports = { iaExterna, procesar, cambiarModo, digester, breaker };
