// Actividades PÚBLICAS de la Arena · Semana 5 (sin respuestas).
// Las respuestas y explicaciones viven cifradas en answers.enc.json y solo
// el profesor las descifra con su contraseña.
// Tipos: quiz · tf · order · poll · cloud (nube de palabras) · open (pregunta abierta)
//        scale (escala 1 a 5 por tema) · points (reparte 100 puntos) · number (adivina el número)
// En las preguntas de tipo "order" las opciones ya están desordenadas.
const TEMAS = ['Guardar eventos (Event Sourcing)', 'Outbox, CDC y SAGA', 'Coordinar flujos', 'Latencia y particiones', 'Consistencia (CAP)'];

export const ROUNDS = [
  { id: 'r1', n: 1, slide: 'r1', phase: 'Rompehielos', topic: 'Capstone checkpoint', qs: [
    { id: 'q1a', type: 'cloud', t: 40, q: 'Una palabra: ¿cómo va PixPro esta semana?' },
    { id: 'q1b', type: 'scale', t: 45, q: '¿Qué tan seguro te sientes con cada tema de hoy?', o: TEMAS, lo: 'nada', hi: 'podría explicarlo' },
    { id: 'q1c', type: 'open', t: 60, q: 'Escribe un riesgo técnico de tu equipo en PixPro' },
  ] },
  { id: 'r2', n: 2, slide: 'r2', phase: 'Event Sourcing', topic: 'Guardar y reproducir eventos', qs: [
    { id: 'q2a', type: 'number', t: 30, q: 'Un lote de 3 imágenes termina bien. ¿Cuántos eventos quedan en su log? (LoteCreado, CreditosReservados…)', unit: 'eventos' },
    { id: 'q2b', type: 'quiz', t: 25, q: 'Un bug en el Digester cobró mal los créditos durante una semana. Con Event Sourcing, ¿cómo se repara?', o: ['Editar la tabla de créditos a mano', 'Corregir el código y reprocesar los eventos', 'Borrar los lotes de esa semana', 'Restaurar el backup de hace una semana'] },
    { id: 'q2c', type: 'tf', t: 12, q: 'En Event Sourcing se pueden editar eventos pasados para corregir un error.', o: ['Verdadero', 'Falso'] },
  ] },
  { id: 'r3', n: 3, slide: 'r3', phase: 'Outbox, CDC y SAGA', topic: 'Outbox, CDC y SAGA', qs: [
    { id: 'q3a', type: 'order', t: 35, q: 'Ordena lo que pasa en la SAGA de PixPro cuando falla el CDN', o: ['Descartar resultados', 'Procesar imágenes', 'Liberar créditos', 'Falla el CDN'] },
    { id: 'q3b', type: 'quiz', t: 20, q: 'Con el patrón Outbox, ¿por qué el consumidor debe ser idempotente?', o: ['El relay puede publicar el mismo evento dos veces', 'La base de datos es eventual', 'El broker borra mensajes', 'No necesita serlo'] },
    { id: 'q3c', type: 'quiz', t: 20, q: 'El IAM externo no emite eventos y no puedes tocar su código. Para enterarte cuando cambia un usuario usas…', o: ['Outbox dentro del IAM', 'CDC sobre su base de datos', 'Una SAGA', 'Un circuit breaker'] },
  ] },
  { id: 'r4', n: 4, slide: 'r4', phase: 'Coordinación', topic: 'Coordinar flujos complejos', qs: [
    { id: 'q4a', type: 'points', t: 50, q: 'Reparte 100 puntos: ¿en qué flujo de PixPro importa MÁS el orden de los eventos?', o: ['Estados de un lote', 'Cobro de créditos', 'Notificaciones', 'Contador de “me gusta”'] },
    { id: 'q4b', type: 'quiz', t: 20, q: 'Dos tutores renombran el mismo proyecto a la vez. Con concurrencia optimista…', o: ['Se guardan los dos cambios', 'El segundo recibe un conflicto y debe releer', 'La tabla se bloquea hasta mañana', 'Gana el más lento'] },
    { id: 'q4c', type: 'quiz', t: 20, q: 'Llega “v3 completado” antes que “v2 procesando” del mismo lote. ¿Qué ayuda al consumidor?', o: ['El número de versión del evento', 'Más memoria', 'Ignorar ambos', 'Cambiar a REST'] },
  ] },
  { id: 'r5', n: 5, slide: 'r5', phase: 'Latencia', topic: 'Optimizar el flujo y la latencia', qs: [
    { id: 'q5a', type: 'number', t: 30, q: '400 eventos enviados uno por uno tardan unos 6 000 ms. En lotes de 50, ¿cuántos milisegundos tardan?', unit: 'ms' },
    { id: 'q5b', type: 'quiz', t: 20, q: 'Particionas por userId y una agencia sube el 40 % de las fotos. ¿Qué ocurre?', o: ['Nada: el hash lo reparte', 'Hotspot: una partición se satura', 'Se pierde el orden de todos los lotes', 'El broker rechaza la clave'] },
    { id: 'q5c', type: 'quiz', t: 20, q: '¿Qué clave conserva el orden de cada lote y reparte bien la carga?', o: ['region', 'userId', 'loteId', 'Un número aleatorio'] },
  ] },
  { id: 'r6', n: 6, slide: 'r6', phase: 'Jefe final', topic: 'Consistencia, disponibilidad y escalabilidad', double: true, qs: [
    { id: 'q6a', type: 'quiz', t: 20, q: 'La IA externa está caída. ¿Qué patrón deja de golpearla y responde rápido con un plan B?', o: ['Reintento infinito', 'Circuit breaker', 'Dead Letter Queue', 'Outbox'] },
    { id: 'q6b', type: 'order', t: 30, q: 'Ordena la vida de un mensaje veneno en la cola (máximo 3 entregas)', o: ['Llega a la Dead Letter Queue', 'Se entrega y falla (1 de 3)', 'Se corrige y se reprocesa', 'Se reintenta y falla (2 y 3 de 3)'] },
    { id: 'q6c', type: 'scale', t: 45, q: '¿Y ahora? ¿Qué tan seguro te sientes con cada tema?', o: TEMAS, lo: 'nada', hi: 'podría explicarlo', compare: 'q1b' },
    { id: 'q6d', type: 'cloud', t: 40, q: 'Una palabra: ¿qué te llevas de la clase de hoy?' },
  ] },
];

export const QUESTIONS = [];
ROUNDS.forEach((r) => r.qs.forEach((q) => QUESTIONS.push({ ...q, round: r })));
export const QMAP = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
export const ROUND_BY_SLIDE = Object.fromEntries(ROUNDS.map((r) => [r.slide, r]));
export const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** Actividades de opinión: no hay respuesta correcta; participar da puntos fijos. */
export const OPINION = new Set(['poll', 'cloud', 'open', 'scale', 'points']);
export const TYPE_LABEL = { quiz: 'Quiz', tf: 'Verdadero o falso', order: 'Ordena los pasos', poll: 'Encuesta', cloud: 'Nube de palabras', open: 'Pregunta abierta', scale: 'Escala 1 a 5', points: 'Reparte 100 puntos', number: 'Adivina el número' };
export const PARTICIPA = 200;

/** ¿La respuesta de opinión es válida? (texto no vacío, escala completa, 100 puntos repartidos) */
export function validOpinion(q, c) {
  if (c == null || c === -1) return false;
  if (q.type === 'cloud' || q.type === 'open') return typeof c === 'string' && c.trim().length > 0;
  if (q.type === 'scale') return Array.isArray(c) && c.length === q.o.length && c.every((v) => v >= 1 && v <= 5);
  if (q.type === 'points') return Array.isArray(c) && c.length === q.o.length && c.reduce((a, b) => a + b, 0) === 100;
  return typeof c === 'number' && c >= 0;
}

/** Cercanía (0..1) para "adivina el número". key = { a, mode: 'abs'|'ratio', tol } */
export function closeness(key, x) {
  if (typeof x !== 'number' || !isFinite(x) || x < 0) return 0;
  if (key.mode === 'ratio') return x === 0 ? 0 : Math.max(0, 1 - Math.abs(Math.log10(x / key.a)));
  return Math.max(0, 1 - Math.abs(x - key.a) / (key.tol || 1));
}

/** Puntos: acierto 500 + hasta 500 por rapidez; opinión 200 fijos; número según cercanía. ×2 en el jefe final. */
export function points(q, ok, ms, extra) {
  const m = q.round.double ? 2 : 1;
  if (OPINION.has(q.type)) return ok === null && extra ? PARTICIPA * m : 0;
  if (q.type === 'number') return Math.round(1000 * (extra || 0) * m);
  if (!ok) return 0;
  const f = Math.max(0, 1 - ms / (q.t * 1000));
  return Math.round((500 + 500 * f) * m);
}
export function isCorrect(q, key, choice) {
  if (OPINION.has(q.type) || !key) return null;
  if (q.type === 'number') return closeness(key, choice) >= (key.okAt ?? 0.99);
  if (q.type === 'order') return Array.isArray(choice) && choice.length === key.a.length && choice.every((v, i) => v === key.a[i]);
  return choice === key.a;
}

/** Normaliza una palabra para la nube. */
export const normWord = (s) => String(s).toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, ' ').slice(0, 24);

/** Resume las respuestas de una actividad para mostrarlas (en vivo y al revelar). */
export function aggregate(q, values) {
  const vals = values.filter((c) => c != null && c !== -1);
  if (q.type === 'cloud') {
    const m = new Map();
    vals.forEach((v) => { const w = normWord(v); if (w) m.set(w, (m.get(w) || 0) + 1); });
    return { n: vals.length, words: [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([w, n]) => ({ w, n })) }; // objetos: Firestore no admite arreglos anidados
  }
  if (q.type === 'open') return { n: vals.length, texts: vals.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim().slice(0, 140)).slice(-40) };
  if (q.type === 'scale' || q.type === 'points') {
    const ok = vals.filter((v) => validOpinion(q, v));
    const avg = q.o.map((_, i) => (ok.length ? ok.reduce((s, v) => s + v[i], 0) / ok.length : 0));
    return { n: ok.length, avg: avg.map((x) => Math.round(x * 10) / 10) };
  }
  if (q.type === 'number') {
    const nums = vals.filter((v) => typeof v === 'number' && isFinite(v)).sort((a, b) => a - b);
    const med = nums.length ? nums[Math.floor(nums.length / 2)] : null;
    return { n: nums.length, med, min: nums[0] ?? null, max: nums[nums.length - 1] ?? null };
  }
  return { n: vals.length };
}
