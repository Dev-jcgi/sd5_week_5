// DEMO 1 sin Azure: Event Sourcing en memoria, para entender la idea en 30 segundos.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { reconstruir, historial } = require('../src/lib/lote.js');

const eventos = [
  { version: 1, type: 'LoteCreado', data: { imagenes: 3, filtros: ['sepia'] } },
  { version: 2, type: 'CreditosReservados', data: { creditos: 3 } },
  { version: 3, type: 'ImagenProcesada', data: { imagenId: 'img_1' } },
  { version: 4, type: 'ImagenFallida', data: { imagenId: 'img_2' } },
  { version: 5, type: 'ImagenProcesada', data: { imagenId: 'img_3' } },
  { version: 6, type: 'LoteCompletado', data: {} },
];

console.log('\nEvento por evento (el estado es una consecuencia):');
for (const p of historial('lote-42', eventos)) {
  const s = p.estado;
  console.log(`  v${p.version} ${p.type.padEnd(19)} → ${s.estado.padEnd(11)} procesadas=${s.procesadas} fallidas=${s.fallidas} créditos=${s.creditos}`);
}
console.log('\nViaje en el tiempo: ¿cómo estaba el lote en la v3?');
console.log('  ', reconstruir('lote-42', eventos, { hasta: 3 }).estado);
const snap = reconstruir('lote-42', eventos, { hasta: 4 }).estado;
const r = reconstruir('lote-42', eventos, { desde: snap });
console.log(`\nCon snapshot en v4 solo se aplican ${r.aplicados} eventos para llegar al estado actual.\n`);
