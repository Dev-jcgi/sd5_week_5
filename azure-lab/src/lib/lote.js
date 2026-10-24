// Agregado "Lote" de PixPro para Event Sourcing.
// El estado NUNCA se guarda: se calcula aplicando los eventos en orden
// (como el saldo de una cuenta es la suma de sus movimientos).

const TIPOS = ['LoteCreado', 'CreditosReservados', 'ImagenProcesada', 'ImagenFallida', 'LoteCompletado', 'CreditosLiberados', 'LoteCancelado'];

const estadoInicial = (id) => ({ id, estado: 'vacio', total: 0, procesadas: 0, fallidas: 0, creditos: 0, filtros: [], version: 0 });

/** Aplica UN evento al estado y devuelve un estado nuevo (función pura). */
function aplicar(s, ev) {
  const d = ev.data || {};
  const n = { ...s, version: ev.version ?? s.version + 1 };
  switch (ev.type) {
    case 'LoteCreado': return { ...n, estado: 'creado', total: d.imagenes || 0, filtros: d.filtros || [] };
    case 'CreditosReservados': return { ...n, creditos: n.creditos + (d.creditos || 0) };
    case 'ImagenProcesada': return { ...n, estado: 'procesando', procesadas: n.procesadas + 1 };
    case 'ImagenFallida': return { ...n, estado: 'procesando', fallidas: n.fallidas + 1 };
    case 'LoteCompletado': return { ...n, estado: 'completado' };
    case 'CreditosLiberados': return { ...n, creditos: Math.max(0, n.creditos - (d.creditos || 0)) };
    case 'LoteCancelado': return { ...n, estado: 'cancelado' };
    default: return n; // lector tolerante: un tipo desconocido no rompe el replay
  }
}

/** Reproduce (replay) los eventos desde un estado inicial o un snapshot. hasta = versión máxima opcional. */
function reconstruir(id, eventos, { desde = null, hasta = Infinity } = {}) {
  let s = desde ? { ...desde } : estadoInicial(id);
  let aplicados = 0;
  for (const ev of eventos) {
    if (ev.version <= s.version) continue;  // ya incluido en el snapshot
    if (ev.version > hasta) break;
    s = aplicar(s, ev);
    aplicados++;
  }
  return { estado: s, aplicados };
}

/** Historial paso a paso (para "viajar en el tiempo" en el panel). */
function historial(id, eventos) {
  const pasos = [];
  let s = estadoInicial(id);
  for (const ev of eventos) { s = aplicar(s, ev); pasos.push({ version: ev.version, type: ev.type, estado: s }); }
  return pasos;
}

/** Reglas mínimas antes de aceptar un evento (las haría el "command handler"). */
function validar(s, type) {
  if (!TIPOS.includes(type)) return `Tipo de evento desconocido: ${type}`;
  if (type !== 'LoteCreado' && s.estado === 'vacio') return 'Primero debe existir LoteCreado';
  if (type === 'LoteCreado' && s.estado !== 'vacio') return 'El lote ya fue creado';
  if (['completado', 'cancelado'].includes(s.estado)) return `El lote está ${s.estado}; no acepta más eventos`;
  return null;
}

module.exports = { TIPOS, estadoInicial, aplicar, reconstruir, historial, validar };
