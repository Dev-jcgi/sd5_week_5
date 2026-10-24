// Consumidor idempotente: recordamos qué mensajes ya procesamos.
// Insertar (consumidor, messageId) en Table Storage es atómico: si ya existe,
// Table devuelve 409 y sabemos que es un DUPLICADO → lo ignoramos.
const { tabla } = require('./clientes');

/** true si es la primera vez que este consumidor ve el mensaje. */
async function primeraVez(consumidor, messageId) {
  const t = await tabla('procesados');
  try {
    await t.createEntity({ partitionKey: consumidor, rowKey: String(messageId).replace(/[\\/#?]/g, '_'), t: new Date().toISOString() });
    return true;
  } catch (e) {
    if (e.statusCode === 409) return false;
    throw e;
  }
}

module.exports = { primeraVez };
