// Prueba de integración del Event Store contra Azurite (emulador local de Storage).
// Solo corre si Azurite está activo:  npm run azurite   (en otra terminal)  y luego  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const arriba = await new Promise((ok) => { const s = net.connect(10002, '127.0.0.1'); s.on('connect', () => { s.end(); ok(true); }); s.on('error', () => ok(false)); });
process.env.StorageConnection = 'UseDevelopmentStorage=true';
const es = require('../src/functions/01-event-sourcing.js');

const req = (id, body, query = '') => ({ params: { id }, query: new URLSearchParams(query), json: async () => body });

test('event store en Azurite: demo, replay, concurrencia y snapshot', { skip: !arriba && 'Azurite no está corriendo' }, async () => {
  const id = 'lote-t' + Date.now().toString(36);
  const demo = await es.cargarDemo(req(id), {});
  assert.equal(demo.jsonBody.estado.estado, 'completado');
  assert.equal(demo.jsonBody.aplicados, 6);

  const antes = await es.reconstruirLote(req(id, null, 'hasta=3'), {});
  assert.equal(antes.jsonBody.estado.procesadas, 1);

  const id2 = id + 'b';
  await es.agregarEvento(req(id2, { type: 'LoteCreado', data: { imagenes: 2 } }), {});
  const [a, b] = await Promise.all([1, 2].map(() => es.agregarEvento(req(id2, { type: 'ImagenProcesada', expectedVersion: 1 }), {})));
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);

  await es.tomarSnapshot(req(id2), {});
  await es.agregarEvento(req(id2, { type: 'ImagenProcesada' }), {});
  const r = await es.reconstruirLote(req(id2), {});
  assert.equal(r.jsonBody.desdeSnapshot, 2);
  assert.equal(r.jsonBody.aplicados, 1);
  assert.equal(r.jsonBody.estado.procesadas, 2);
});
