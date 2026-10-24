// Ejecuta el orquestador de la SAGA con un "motor" mínimo de prueba (sin Durable ni Azure).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
process.env.StorageConnection = ''; // la bitácora fallará en silencio (solo advierte)
const { sagaProcesarLote, actividades } = require('../src/functions/03-saga-orquestada.js');

async function correr(input) {
  const llamadas = [];
  const ctxAct = { log() {}, warn() {} };
  const context = { df: {
    instanceId: 'prueba-' + Math.random().toString(36).slice(2),
    getInput: () => input,
    setCustomStatus() {},
    callActivity: (n, i) => ({ n, i, retry: null }),
    callActivityWithRetry: (n, retry, i) => ({ n, i, retry }),
  } };
  const g = sagaProcesarLote(context);
  let paso = g.next();
  while (!paso.done) {
    const { n, i, retry } = paso.value;
    const max = retry ? retry.maxNumberOfAttempts : 1;
    let err = null, ok = false;
    for (let k = 0; k < max && !ok; k++) {
      llamadas.push(n);
      try { await actividades[n](i, ctxAct); ok = true; } catch (e) { err = e; }
    }
    paso = ok ? g.next('ok') : g.throw(err);
  }
  return { r: paso.value, llamadas };
}

test('camino feliz', async () => {
  const { r } = await correr({ imagenes: 3 });
  assert.equal(r.resultado, 'COMPLETADO');
  assert.deepEqual(r.pasos, ['reservarCreditos', 'procesarImagenes', 'publicarCdn', 'notificarUsuario']);
});

test('fallas temporales se resuelven con reintentos', async () => {
  const { r, llamadas } = await correr({ fallasTemporales: 2 });
  assert.equal(r.resultado, 'COMPLETADO');
  assert.equal(llamadas.filter((x) => x === 'procesarImagenes').length, 3);
});

test('falla en CDN compensa en orden inverso', async () => {
  const { r } = await correr({ fallaEn: 'cdn' });
  assert.equal(r.resultado, 'COMPENSADO');
  assert.equal(r.falloEn, 'publicarCdn');
  assert.deepEqual(r.compensados, ['descartarResultados', 'liberarCreditos']);
});

test('falla en IA solo compensa créditos', async () => {
  const { r } = await correr({ fallaEn: 'ia' });
  assert.deepEqual(r.compensados, ['liberarCreditos']);
});
