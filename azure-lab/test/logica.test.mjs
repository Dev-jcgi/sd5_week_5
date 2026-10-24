// Pruebas de la lógica pura (no necesitan Azure ni Azurite): `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { reconstruir, historial, validar, estadoInicial } = require('../src/lib/lote.js');
const { reintentar, CircuitBreaker } = require('../src/lib/resiliencia.js');

const eventos = [
  { version: 1, type: 'LoteCreado', data: { imagenes: 3 } },
  { version: 2, type: 'CreditosReservados', data: { creditos: 3 } },
  { version: 3, type: 'ImagenProcesada', data: {} },
  { version: 4, type: 'ImagenFallida', data: {} },
  { version: 5, type: 'TipoDelFuturo', data: {} },
  { version: 6, type: 'LoteCompletado', data: {} },
];

test('replay reconstruye el estado completo', () => {
  const { estado, aplicados } = reconstruir('l1', eventos);
  assert.equal(aplicados, 6);
  assert.deepEqual([estado.estado, estado.procesadas, estado.fallidas, estado.creditos, estado.version], ['completado', 1, 1, 3, 6]);
});

test('viaje en el tiempo y snapshot dan el mismo resultado', () => {
  assert.equal(reconstruir('l1', eventos, { hasta: 3 }).estado.estado, 'procesando');
  const snap = reconstruir('l1', eventos, { hasta: 4 }).estado;
  const r = reconstruir('l1', eventos, { desde: snap });
  assert.equal(r.aplicados, 2);
  assert.deepEqual(r.estado, reconstruir('l1', eventos).estado);
});

test('historial devuelve un estado por evento y lector tolerante', () => {
  assert.equal(historial('l1', eventos).length, 6);
});

test('validaciones del command handler', () => {
  assert.match(validar(estadoInicial('x'), 'ImagenProcesada'), /LoteCreado/);
  assert.equal(validar(estadoInicial('x'), 'LoteCreado'), null);
  assert.match(validar(reconstruir('l1', eventos).estado, 'ImagenProcesada'), /completado/);
});

test('reintento con backoff: éxito al tercer intento', async () => {
  let n = 0; const esperas = [];
  const r = await reintentar(async () => { if (++n < 3) throw new Error('503'); return 'ok'; }, { baseMs: 100, jitter: false, dormir: async (ms) => esperas.push(ms) });
  assert.equal(r.ok, true);
  assert.deepEqual(esperas, [100, 200]);
});

test('circuit breaker: se abre, falla rápido y se recupera', async () => {
  let t = 0; const cb = new CircuitBreaker({ umbral: 2, enfriamientoMs: 1000, ahora: () => t });
  const falla = async () => { throw new Error('x'); };
  await assert.rejects(cb.ejecutar(falla)); await assert.rejects(cb.ejecutar(falla));
  assert.equal(cb.estado, 'ABIERTO');
  await assert.rejects(cb.ejecutar(async () => 'ok'), /ABIERTO/);
  t = 1500;
  assert.equal(await cb.ejecutar(async () => 'ok'), 'ok');
  assert.equal(cb.estado, 'CERRADO');
});
