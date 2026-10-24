// Clientes perezosos (se crean la primera vez que se usan) para Table Storage,
// Cosmos DB y Service Bus, más una "bitácora" que el panel muestra en vivo.
const { TableClient } = require('@azure/data-tables');

const env = (k) => process.env[k] || '';
const STORAGE = () => env('StorageConnection') || env('AzureWebJobsStorage');

const tablas = new Map();
/** Devuelve un TableClient listo (crea la tabla si no existe). */
async function tabla(nombre) {
  if (!tablas.has(nombre)) {
    const conn = STORAGE();
    if (!conn) throw new Error('Falta StorageConnection en local.settings.json');
    const local = /UseDevelopmentStorage|http:\/\//i.test(conn);
    const c = TableClient.fromConnectionString(conn, nombre, { allowInsecureConnection: local });
    tablas.set(nombre, c.createTable().then(() => c));
  }
  return tablas.get(nombre);
}

let cosmosContainer = null;
/** Contenedor "lotes" de Cosmos DB (partición /loteId). */
function cosmos() {
  if (!cosmosContainer) {
    const conn = env('CosmosDBConnection');
    if (!conn) throw new Error('Falta CosmosDBConnection: ejecuta infra/crear-recursos.sh (Demo 2 necesita Azure).');
    const { CosmosClient } = require('@azure/cosmos');
    cosmosContainer = new CosmosClient(conn).database('pixpro').container('lotes');
  }
  return cosmosContainer;
}

let sb = null;
/** Cliente de Service Bus compartido. */
function serviceBus() {
  if (!sb) {
    const conn = env('ServiceBusConnection');
    if (!conn) throw new Error('Falta ServiceBusConnection: ejecuta infra/crear-recursos.sh (Demos 2 y 4 necesitan Azure).');
    const { ServiceBusClient } = require('@azure/service-bus');
    sb = new ServiceBusClient(conn);
  }
  return sb;
}

const hay = { cosmos: () => !!env('CosmosDBConnection'), serviceBus: () => !!env('ServiceBusConnection') };

/** Escribe una línea en la bitácora (Table Storage) y en el log de Functions. */
async function bitacora(context, demo, mensaje, extra) {
  const linea = `[${demo}] ${mensaje}`;
  context?.log?.(linea);
  try {
    const t = await tabla('bitacora');
    const rk = String(9999999999999 - Date.now()).padStart(13, '0') + Math.random().toString(36).slice(2, 6);
    await t.createEntity({ partitionKey: 'log', rowKey: rk, demo, mensaje, extra: extra ? JSON.stringify(extra) : '', t: new Date().toISOString() });
  } catch (e) { context?.warn?.('No se pudo escribir la bitácora: ' + e.message); }
}

async function leerBitacora(max = 40) {
  const t = await tabla('bitacora');
  const it = t.listEntities({ queryOptions: { filter: "PartitionKey eq 'log'" } }).byPage({ maxPageSize: max });
  const { value } = await it.next();
  return (value || []).slice(0, max).map((e) => ({ t: e.t, demo: e.demo, mensaje: e.mensaje, extra: e.extra ? JSON.parse(e.extra) : undefined }));
}

module.exports = { tabla, cosmos, serviceBus, hay, bitacora, leerBitacora };
