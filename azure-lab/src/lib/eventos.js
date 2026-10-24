// Sobre (envelope) de un evento: encabezados + datos.
// Los encabezados son los que pide la guía de la Semana 5:
// id único, timestamp, versión del esquema y correlationId para trazabilidad.
const { randomUUID } = require('node:crypto');

function crearEvento(type, data, opts = {}) {
  return {
    id: opts.id || randomUUID(),
    type,                                   // p. ej. "LoteCreado"
    schemaVersion: opts.schemaVersion || 1, // versión del esquema del evento
    source: opts.source || 'pixpro/api',
    aggregateId: opts.aggregateId || null,  // a qué lote pertenece
    version: opts.version ?? null,          // posición del evento en el lote (event sourcing)
    correlationId: opts.correlationId || randomUUID(),
    time: opts.time || new Date().toISOString(),
    data: data || {},
  };
}

module.exports = { crearEvento };
