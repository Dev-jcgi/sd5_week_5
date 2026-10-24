// DEMO 5a · Particionamiento y hotspotting (sin Azure: corre con `node`).
// Simula 20 000 eventos de PixPro repartidos en 8 particiones con tres claves distintas.
import { createHash } from 'node:crypto';

const P = 8, N = 20000;
const hash = (k) => createHash('md5').update(String(k)).digest().readUInt32BE(0) % P;

// 200 usuarios; uno es una agencia que sube el 40 % de todas las imágenes (cliente "caliente").
const eventos = Array.from({ length: N }, (_, i) => {
  const userId = Math.random() < 0.4 ? 'agencia-mega' : 'user-' + Math.floor(Math.random() * 200);
  return { i, userId, loteId: `${userId}-lote-${Math.floor(i / 50)}`, region: ['mx', 'mx', 'mx', 'co', 'ar', 'cl'][i % 6] };
});

const estrategias = {
  'Por región        ': (e) => ['mx', 'co', 'ar', 'cl'].indexOf(e.region) % P,
  'Por userId        ': (e) => hash(e.userId),
  'Por loteId        ': (e) => hash(e.loteId),
  'userId + sal (0–3)': (e) => hash(e.userId === 'agencia-mega' ? `${e.userId}#${e.i % 4}` : e.userId),
};

console.log(`\n${N} eventos en ${P} particiones. Ideal: ${N / P} por partición.\n`);
for (const [nombre, f] of Object.entries(estrategias)) {
  const c = Array(P).fill(0);
  for (const e of eventos) c[f(e)]++;
  const max = Math.max(...c), carga = (max / (N / P)).toFixed(1);
  console.log(`${nombre}  partición más cargada = ${carga}× el ideal ${carga > 2 ? '🔥 HOTSPOT' : '✓'}`);
  c.forEach((n, i) => console.log(`   p${i} ${'█'.repeat(Math.round((n / max) * 40)).padEnd(40)} ${n}`));
  console.log();
}
console.log('Lección: la clave decide el ORDEN (dentro de una partición) y el REPARTO. Por loteId se reparte bien y');
console.log('se conserva el orden de cada lote; "salar" la clave de un cliente caliente reparte su carga pero pierde');
console.log('el orden global de ese cliente (solo se mantiene por sub-clave).\n');
