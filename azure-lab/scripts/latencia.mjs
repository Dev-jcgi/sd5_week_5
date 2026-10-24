// DEMO 5b · ¿De dónde sale la latencia? Envío uno a uno vs. por lotes vs. en paralelo.
// Simulación: cada viaje de red al broker cuesta ~15 ms + 0.05 ms por mensaje.
const RTT = 15, POR_MSG = 0.05, N = 400;
const viaje = (n) => new Promise((r) => setTimeout(r, RTT + n * POR_MSG));

async function medir(nombre, fn) {
  const t0 = performance.now();
  await fn();
  const ms = performance.now() - t0;
  console.log(`${nombre.padEnd(34)} ${ms.toFixed(0).padStart(6)} ms   ${(N / (ms / 1000)).toFixed(0).padStart(6)} msg/s`);
}

console.log(`\nEnviar ${N} eventos "ImagenProcesada" al broker\n`);
await medir('1 · Uno por uno (await cada uno)', async () => { for (let i = 0; i < N; i++) await viaje(1); });
await medir('2 · Lotes de 50 (batching)', async () => { for (let i = 0; i < N; i += 50) await viaje(50); });
await medir('3 · Lotes de 50, 4 en paralelo', async () => {
  const lotes = Array.from({ length: N / 50 }, () => 50);
  while (lotes.length) await Promise.all(lotes.splice(0, 4).map(viaje));
});
console.log('\nLección: casi todo el costo es el viaje de red, no el mensaje. Agrupar y paralelizar sube el throughput;');
console.log('el precio es que el primer mensaje de cada lote espera a que el lote se llene (latencia por mensaje).\n');
