// Patrones de resiliencia en su forma más simple: reintento con backoff
// exponencial + jitter y un circuit breaker de tres estados.

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Reintenta fn() hasta `intentos` veces. Espera base·2^n (+ jitter aleatorio).
 * Devuelve { ok, valor | error, bitacora: [{intento, espera, error}] }.
 */
async function reintentar(fn, { intentos = 4, baseMs = 200, maxMs = 3000, jitter = true, dormir = esperar } = {}) {
  const bitacora = [];
  for (let n = 0; n < intentos; n++) {
    try {
      const valor = await fn(n + 1);
      bitacora.push({ intento: n + 1, resultado: 'ok' });
      return { ok: true, valor, bitacora };
    } catch (e) {
      const ultimo = n === intentos - 1;
      const exp = Math.min(maxMs, baseMs * 2 ** n);
      const espera = ultimo ? 0 : Math.round(jitter ? exp / 2 + Math.random() * (exp / 2) : exp);
      bitacora.push({ intento: n + 1, resultado: 'error', error: e.message, espera });
      if (e.permanente || ultimo) return { ok: false, error: e.message, bitacora };
      await dormir(espera);
    }
  }
}

/**
 * Circuit breaker: CERRADO (pasa todo) → ABIERTO tras `umbral` fallos seguidos
 * (falla rápido sin llamar) → MEDIO_ABIERTO pasado `enfriamientoMs` (deja pasar
 * una prueba: si sale bien se cierra, si falla vuelve a abrirse).
 */
class CircuitBreaker {
  constructor({ umbral = 3, enfriamientoMs = 10000, ahora = () => Date.now() } = {}) {
    Object.assign(this, { umbral, enfriamientoMs, ahora, estado: 'CERRADO', fallos: 0, abiertoEn: 0 });
  }
  async ejecutar(fn) {
    if (this.estado === 'ABIERTO') {
      if (this.ahora() - this.abiertoEn < this.enfriamientoMs) {
        const e = new Error('Circuito ABIERTO: se responde rápido sin llamar al servicio (fallback)');
        e.circuitoAbierto = true; e.permanente = true;
        throw e;
      }
      this.estado = 'MEDIO_ABIERTO';
    }
    try {
      const r = await fn();
      this.estado = 'CERRADO'; this.fallos = 0;
      return r;
    } catch (e) {
      this.fallos++;
      if (this.estado === 'MEDIO_ABIERTO' || this.fallos >= this.umbral) { this.estado = 'ABIERTO'; this.abiertoEn = this.ahora(); }
      throw e;
    }
  }
  info() { return { estado: this.estado, fallosSeguidos: this.fallos, umbral: this.umbral, enfriamientoMs: this.enfriamientoMs }; }
}

module.exports = { reintentar, CircuitBreaker, esperar };
