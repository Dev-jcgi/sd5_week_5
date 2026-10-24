// Preguntas PÚBLICAS de la Arena · Semana 5 (sin respuestas).
// Las respuestas y explicaciones viven cifradas en answers.enc.json y solo
// el profesor las descifra con su contraseña.
// En las preguntas de tipo "order" las opciones ya están desordenadas.
export const ROUNDS = [
  { id: 'r1', n: 1, slide: 'g1a', phase: 'Calentamiento', topic: 'Capstone checkpoint', qs: [
    { id: 'q1a', type: 'poll', t: 20, q: '¿Cómo va PixPro esta semana?', o: ['Diagrama EDA y Event Bus listos', 'PoC de IA en progreso', 'SPA y API funcionando en local', 'Atorados en algo concreto'] },
    { id: 'q1b', type: 'poll', t: 20, q: '¿Qué parte del flujo de PixPro les preocupa más que falle?', o: ['Upload / API', 'Broker', 'Digester / IA', 'Notifier / WebSocket'] },
  ] },
  { id: 'r2', n: 2, slide: 'g1b', phase: 'Reflexión capstone', topic: 'Capstone checkpoint', qs: [
    { id: 'q2a', type: 'quiz', t: 25, q: 'La API guarda el lote y luego publica BatchQueued. El broker cae justo entre ambos pasos. ¿Qué pasa?', o: ['Nada: el broker reintenta solo', 'El lote queda guardado y nadie lo procesa', 'La BD revierte el lote automáticamente', 'El usuario ve un error y reintenta'] },
    { id: 'q2b', type: 'quiz', t: 15, q: '“ProcesarImagen” es un evento…', o: ['De dominio', 'De comando', 'Delta', 'De notificación'] },
    { id: 'q2c', type: 'tf', t: 12, q: 'Para el cobro de créditos de PixPro conviene un broker efímero como Redis Pub/Sub.', o: ['Verdadero', 'Falso'] },
  ] },
  { id: 'r3', n: 3, slide: 'g2a', phase: 'Calentamiento', topic: 'Almacenar y reproducir eventos', qs: [
    { id: 'q3a', type: 'quiz', t: 20, q: 'Tu saldo bancario es la suma de todos tus movimientos. ¿Qué patrón describe esa idea?', o: ['CQRS', 'Event Sourcing', 'Outbox', 'Circuit breaker'] },
    { id: 'q3b', type: 'tf', t: 12, q: 'En Event Sourcing se pueden editar eventos pasados para corregir un error.', o: ['Verdadero', 'Falso'] },
  ] },
  { id: 'r4', n: 4, slide: 'g2b', phase: 'Reflexión capstone', topic: 'Almacenar y reproducir eventos', qs: [
    { id: 'q4a', type: 'quiz', t: 25, q: 'Un bug en el Digester cobró mal los créditos durante una semana. Con Event Sourcing, ¿cómo se repara?', o: ['Editar la tabla de créditos a mano', 'Corregir el código y reprocesar los eventos', 'Borrar los lotes de esa semana', 'Restaurar el backup de hace una semana'] },
    { id: 'q4b', type: 'quiz', t: 15, q: 'Un lote tiene 50 000 eventos y reconstruirlo tarda mucho. ¿Qué agregas?', o: ['Snapshots', 'Más colas en RabbitMQ', '2PC', 'Un evento delta'] },
    { id: 'q4c', type: 'order', t: 30, q: 'Ordena cómo se reconstruye el estado de un lote usando un snapshot', o: ['Aplicar los eventos posteriores en orden', 'Leer el último snapshot', 'Leer los eventos con versión mayor al snapshot', 'Devolver el estado actual'] },
  ] },
  { id: 'r5', n: 5, slide: 'g3a', phase: 'Calentamiento', topic: 'Outbox, CDC y SAGA', qs: [
    { id: 'q5a', type: 'quiz', t: 15, q: '¿Cuál de estas herramientas es popular para Change Data Capture?', o: ['Debezium', 'Nginx', 'Redis Pub/Sub', 'Postman'] },
    { id: 'q5b', type: 'tf', t: 12, q: '2PC es la forma recomendada de coordinar transacciones entre microservicios.', o: ['Verdadero', 'Falso'] },
  ] },
  { id: 'r6', n: 6, slide: 'g3b', phase: 'Reflexión capstone', topic: 'Outbox, CDC y SAGA', qs: [
    { id: 'q6a', type: 'quiz', t: 25, q: 'Reservar créditos → procesar → publicar en CDN. Falla el CDN. ¿Qué se compensa y en qué orden?', o: ['Liberar créditos y luego descartar resultados', 'Descartar resultados y luego liberar créditos', 'Reintentar el CDN para siempre', 'Nada; el lote queda a medias'] },
    { id: 'q6b', type: 'quiz', t: 20, q: 'Con el patrón Outbox, ¿por qué el consumidor debe ser idempotente?', o: ['El relay puede publicar el mismo evento dos veces', 'La base de datos es eventual', 'El broker borra mensajes', 'No necesita serlo'] },
    { id: 'q6c', type: 'quiz', t: 20, q: 'El IAM externo no emite eventos y no puedes tocar su código. Para enterarte cuando cambia un usuario usas…', o: ['Outbox dentro del IAM', 'CDC sobre su base de datos', 'Una SAGA', 'Un circuit breaker'] },
  ] },
  { id: 'r7', n: 7, slide: 'g4a', phase: 'Calentamiento', topic: 'Coordinación de flujos', qs: [
    { id: 'q7a', type: 'quiz', t: 15, q: 'Un controlador central le dice a cada servicio qué hacer y cuándo. Eso es…', o: ['Coreografía', 'Orquestación', 'Pub/Sub', 'Event mesh'] },
    { id: 'q7b', type: 'tf', t: 12, q: 'En la coreografía no existe un punto único que conozca todo el flujo.', o: ['Verdadero', 'Falso'] },
  ] },
  { id: 'r8', n: 8, slide: 'g4b', phase: 'Reflexión capstone', topic: 'Coordinación de flujos', qs: [
    { id: 'q8a', type: 'quiz', t: 20, q: 'Dos tutores renombran el mismo proyecto a la vez. Con concurrencia optimista…', o: ['Se guardan los dos cambios', 'El segundo recibe un conflicto y debe releer', 'La tabla se bloquea hasta mañana', 'Gana el más lento'] },
    { id: 'q8b', type: 'quiz', t: 20, q: 'Llega “v3 completado” antes que “v2 procesando” del mismo lote. ¿Qué ayuda al consumidor?', o: ['El número de versión del evento', 'Más memoria', 'Ignorar ambos', 'Cambiar a REST'] },
    { id: 'q8c', type: 'poll', t: 20, q: 'Para el procesamiento de lotes, su equipo prefiere…', o: ['Orquestación', 'Coreografía', 'Mixto: coreografía + orquestador para compensar', 'Aún no sabemos'] },
  ] },
  { id: 'r9', n: 9, slide: 'g5a', phase: 'Calentamiento', topic: 'Flujo y latencia', qs: [
    { id: 'q9a', type: 'quiz', t: 20, q: 'Enviar 400 eventos uno por uno tarda 6 s; en lotes de 50, 0.14 s. ¿Por qué?', o: ['El broker comprime mejor los lotes', 'Casi todo el costo es el viaje de red', 'Los lotes se saltan la validación', 'Es un error de medición'] },
    { id: 'q9b', type: 'tf', t: 12, q: 'Un evento más grande siempre reduce la latencia porque evita consultas.', o: ['Verdadero', 'Falso'] },
  ] },
  { id: 'r10', n: 10, slide: 'g5b', phase: 'Reflexión capstone', topic: 'Flujo y latencia', qs: [
    { id: 'q10a', type: 'quiz', t: 20, q: 'Particionas por userId y una agencia sube el 40 % de las fotos. ¿Qué ocurre?', o: ['Nada: el hash lo reparte', 'Hotspot: una partición se satura', 'Se pierde el orden de todos los lotes', 'El broker rechaza la clave'] },
    { id: 'q10b', type: 'quiz', t: 20, q: '¿Qué clave conserva el orden de cada lote y reparte bien la carga?', o: ['region', 'userId', 'loteId', 'Un número aleatorio'] },
    { id: 'q10c', type: 'quiz', t: 20, q: 'Agregas el campo “gpu” a ImagenProcesada. ¿Cómo no rompes a los consumidores viejos?', o: ['Campo opcional + schemaVersion en el encabezado', 'Renombrar “filtro” a “filtros” sin avisar', 'Cambiar “ms” de número a texto', 'Borrar los eventos viejos del log'] },
  ] },
  { id: 'r11', n: 11, slide: 'g6a', phase: 'Calentamiento', topic: 'Consistencia, disponibilidad y escalabilidad', qs: [
    { id: 'q11a', type: 'quiz', t: 20, q: 'Durante una partición de red, un sistema AP…', o: ['Deja de responder para no mostrar datos viejos', 'Sigue respondiendo, aunque con datos desactualizados', 'Garantiza consistencia y disponibilidad', 'Desactiva la red hasta que se repare'] },
    { id: 'q11b', type: 'quiz', t: 20, q: '¿Qué combinación usan la mayoría de los sistemas críticos?', o: ['At-most-once sin reintentos', 'At-least-once + consumidor idempotente', 'Exactly-once garantizado por la red', 'Ninguna garantía'] },
  ] },
  { id: 'r12', n: 12, slide: 'g6b', phase: 'Jefe final', topic: 'Consistencia, disponibilidad y escalabilidad', double: true, qs: [
    { id: 'q12a', type: 'quiz', t: 20, q: 'La IA externa está caída. ¿Qué patrón deja de golpearla y responde rápido con un plan B?', o: ['Reintento infinito', 'Circuit breaker', 'Dead Letter Queue', 'Outbox'] },
    { id: 'q12b', type: 'order', t: 30, q: 'Ordena la vida de un mensaje veneno en Service Bus (maxDeliveryCount = 3)', o: ['Llega a la Dead Letter Queue', 'Se entrega y falla (1 de 3)', 'Se corrige y se reprocesa', 'Se reintenta y falla (2 y 3 de 3)'] },
    { id: 'q12c', type: 'quiz', t: 15, q: '¿Qué dato de PixPro necesita consistencia más fuerte?', o: ['El contador de “me gusta”', 'El saldo de créditos', 'Ambos igual', 'Ninguno'] },
  ] },
];

export const QUESTIONS = [];
ROUNDS.forEach((r) => r.qs.forEach((q) => QUESTIONS.push({ ...q, round: r })));
export const QMAP = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
export const ROUND_BY_SLIDE = Object.fromEntries(ROUNDS.map((r) => [r.slide, r]));
export const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** Puntos: acierto 500 + hasta 500 por rapidez; ×2 en el jefe final. */
export function points(q, ok, ms) {
  if (!ok) return 0;
  const f = Math.max(0, 1 - ms / (q.t * 1000));
  return Math.round((500 + 500 * f) * (q.round.double ? 2 : 1));
}
export function isCorrect(q, key, choice) {
  if (q.type === 'poll' || !key) return null;
  if (q.type === 'order') return Array.isArray(choice) && choice.length === key.a.length && choice.every((v, i) => v === key.a[i]);
  return choice === key.a;
}
