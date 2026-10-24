// DEMO 5c · Versionamiento de esquemas de eventos (apoya la Tarea 5.4).
// ImagenProcesada v1 → v2: "filtro" (string) pasa a "filtros" (lista) y se agrega "ms".

const v1 = { type: 'ImagenProcesada', schemaVersion: 1, data: { imagenId: 'img_7', filtro: 'sepia' } };
const v2 = { type: 'ImagenProcesada', schemaVersion: 2, data: { imagenId: 'img_8', filtros: ['sepia', 'resize'], ms: 840, gpu: 'T4' } };

// Upcaster: convierte eventos viejos al esquema nuevo al leerlos (compatibilidad HACIA ATRÁS).
function upcast(ev) {
  if (ev.type === 'ImagenProcesada' && ev.schemaVersion === 1) {
    return { ...ev, schemaVersion: 2, data: { imagenId: ev.data.imagenId, filtros: [ev.data.filtro], ms: null } };
  }
  return ev;
}

// Consumidor NUEVO (entiende v2) recibiendo eventos viejos y nuevos.
const consumidorV2 = (ev) => { const e = upcast(ev); return `${e.data.imagenId}: ${e.data.filtros.join('+')} (${e.data.ms ?? '¿?'} ms)`; };

// Consumidor VIEJO (escrito para v1) que es LECTOR TOLERANTE: ignora campos que no conoce
// y no truena si falta "filtro" (compatibilidad HACIA ADELANTE).
const consumidorV1 = (ev) => `${ev.data.imagenId}: ${ev.data.filtro ?? ev.data.filtros?.[0] ?? 'sin filtro'}`;

console.log('\nHacia atrás  (consumidor v2 lee v1 y v2):');
for (const e of [v1, v2]) console.log('  ', consumidorV2(e));
console.log('Hacia adelante (consumidor v1 lee v1 y v2):');
for (const e of [v1, v2]) console.log('  ', consumidorV1(e));
console.log('\nReglas prácticas: agrega campos opcionales, nunca cambies el significado de uno existente,');
console.log('versiona en el encabezado (schemaVersion) y depreca con aviso. Un cambio incompatible = tipo nuevo (ImagenProcesadaV2).\n');
