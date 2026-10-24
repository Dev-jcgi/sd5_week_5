// Event store sobre Azure Table Storage.
//   PartitionKey = id del lote   → todos los eventos de un lote juntos
//   RowKey       = versión (10 dígitos) → orden natural y unicidad
// Concurrencia OPTIMISTA: si dos procesos intentan escribir la misma versión,
// Table Storage rechaza el segundo con 409 (la fila ya existe).
const { tabla } = require('./clientes');

const rk = (v) => String(v).padStart(10, '0');

class ConflictoDeVersion extends Error {
  constructor(esperada) { super(`Conflicto: alguien ya escribió la versión ${esperada + 1}`); this.status = 409; }
}

/** Lee los eventos de un lote en orden (opcionalmente a partir de una versión). */
async function leer(loteId, desdeVersion = 0) {
  const t = await tabla('eventos');
  const filtro = `PartitionKey eq '${loteId.replace(/'/g, "''")}' and RowKey gt '${rk(desdeVersion)}'`;
  const out = [];
  for await (const e of t.listEntities({ queryOptions: { filter: filtro } })) {
    out.push({ id: e.eventId, type: e.type, version: Number(e.rowKey), time: e.time, correlationId: e.correlationId, schemaVersion: e.schemaVersion, data: JSON.parse(e.data || '{}') });
  }
  return out.sort((a, b) => a.version - b.version);
}

/** Agrega un evento. expectedVersion = la versión que el cliente vio por última vez. */
async function agregar(loteId, evento, expectedVersion) {
  const t = await tabla('eventos');
  const version = expectedVersion + 1;
  try {
    await t.createEntity({
      partitionKey: loteId, rowKey: rk(version),
      eventId: evento.id, type: evento.type, time: evento.time, correlationId: evento.correlationId,
      schemaVersion: evento.schemaVersion, data: JSON.stringify(evento.data || {}),
    });
  } catch (e) {
    if (e.statusCode === 409) throw new ConflictoDeVersion(expectedVersion);
    throw e;
  }
  return { ...evento, aggregateId: loteId, version };
}

async function guardarSnapshot(loteId, estado) {
  const t = await tabla('snapshots');
  await t.upsertEntity({ partitionKey: loteId, rowKey: 'ultimo', version: estado.version, estado: JSON.stringify(estado) }, 'Replace');
}

async function leerSnapshot(loteId) {
  const t = await tabla('snapshots');
  try { const e = await t.getEntity(loteId, 'ultimo'); return JSON.parse(e.estado); }
  catch (e) { if (e.statusCode === 404) return null; throw e; }
}

module.exports = { leer, agregar, guardarSnapshot, leerSnapshot, ConflictoDeVersion };
