// DEMO 3 · SAGA ORQUESTADA con Durable Functions (corre local con Azurite, sin costo).
//
//   POST /api/saga/lotes  { imagenes: 3, fallaEn: null | "ia" | "cdn", fallasTemporales: 0..3 }
//   GET  /api/saga/{instanceId}   → estado, paso actual y pasos completados/compensados
//
// Pasos: reservarCreditos → procesarImagenes (con reintentos y backoff) → publicarCdn → notificar
// Si un paso falla de forma permanente, el orquestador ejecuta las COMPENSACIONES en orden inverso.
const { app } = require('@azure/functions');
const df = require('durable-functions');
const { bitacora } = require('../lib/clientes');

// Contador de intentos en memoria (solo para simular fallas temporales en la demo).
const intentos = new Map();

const PASOS = [
  { paso: 'reservarCreditos', compensacion: 'liberarCreditos', reintentos: false },
  { paso: 'procesarImagenes', compensacion: 'descartarResultados', reintentos: true },
  { paso: 'publicarCdn', compensacion: 'borrarDelCdn', reintentos: false },
  { paso: 'notificarUsuario', compensacion: null, reintentos: false },
];

/* ---------- orquestador (debe ser determinista: nada de Date.now() ni random aquí) ---------- */
function* sagaProcesarLote(context) {
  const input = context.df.getInput();
  const reintento = new df.RetryOptions(1000, 4); // primer reintento a 1 s, máx. 4 intentos
  reintento.backoffCoefficient = 2;               // 1 s, 2 s, 4 s…
  const hechos = [];
  const status = (extra) => context.df.setCustomStatus({ pasos: PASOS.map((p) => p.paso), hechos: [...hechos], ...extra });

  for (const p of PASOS) {
    status({ actual: p.paso });
    try {
      yield p.reintentos
        ? context.df.callActivityWithRetry(p.paso, reintento, { ...input, instanceId: context.df.instanceId })
        : context.df.callActivity(p.paso, { ...input, instanceId: context.df.instanceId });
      hechos.push(p.paso);
    } catch (err) {
      const motivo = (err && err.message ? err.message : String(err)).split('\n')[0];
      const compensados = [];
      for (const h of [...hechos].reverse()) {
        const c = PASOS.find((x) => x.paso === h).compensacion;
        if (!c) continue;
        status({ actual: c, fallo: p.paso, compensando: true, compensados });
        yield context.df.callActivity(c, { ...input, instanceId: context.df.instanceId });
        compensados.push(c);
      }
      status({ actual: null, fallo: p.paso, compensados });
      return { resultado: 'COMPENSADO', falloEn: p.paso, motivo, compensados };
    }
  }
  status({ actual: null });
  return { resultado: 'COMPLETADO', pasos: hechos };
}

/* ---------- actividades (cada una = un servicio de PixPro) ---------- */
const log = (ctx, input, msg) => bitacora(ctx, 'SAGA', `${input.instanceId.slice(0, 8)} · ${msg}`);
const actividades = {
  reservarCreditos: async (i, ctx) => { await log(ctx, i, `Créditos: reservados ${i.imagenes || 3}`); return 'ok'; },
  procesarImagenes: async (i, ctx) => {
    const n = (intentos.get(i.instanceId) || 0) + 1;
    intentos.set(i.instanceId, n);
    if (n <= (i.fallasTemporales || 0)) { await log(ctx, i, `Digester: falla TEMPORAL (intento ${n}) → Durable reintenta con backoff`); throw new Error('IA ocupada (503)'); }
    if (i.fallaEn === 'ia') { await log(ctx, i, 'Digester: falla PERMANENTE (formato inválido) → hay que compensar'); throw new Error('Formato de imagen inválido'); }
    await log(ctx, i, `Digester: ${i.imagenes || 3} imágenes procesadas (intento ${n})`); return 'ok';
  },
  publicarCdn: async (i, ctx) => {
    if (i.fallaEn === 'cdn') { await log(ctx, i, 'CDN: no responde → hay que compensar'); throw new Error('CDN no disponible'); }
    await log(ctx, i, 'CDN: resultados publicados'); return 'ok';
  },
  notificarUsuario: async (i, ctx) => { await log(ctx, i, 'Notifier: "tu lote está listo" (WebSocket)'); return 'ok'; },
  liberarCreditos: async (i, ctx) => { await log(ctx, i, 'COMPENSA Créditos: liberados'); return 'ok'; },
  descartarResultados: async (i, ctx) => { await log(ctx, i, 'COMPENSA Digester: resultados descartados'); return 'ok'; },
  borrarDelCdn: async (i, ctx) => { await log(ctx, i, 'COMPENSA CDN: archivos borrados'); return 'ok'; },
};

df.app.orchestration('sagaProcesarLote', sagaProcesarLote);
for (const [nombre, handler] of Object.entries(actividades)) df.app.activity(nombre, { handler });

app.http('sagaIniciar', {
  methods: ['POST'], authLevel: 'anonymous', route: 'saga/lotes', extraInputs: [df.input.durableClient()],
  handler: async (req, ctx) => {
    const body = await req.json().catch(() => ({}));
    const input = { imagenes: body.imagenes || 3, fallaEn: body.fallaEn || null, fallasTemporales: body.fallasTemporales || 0 };
    const client = df.getClient(ctx);
    const instanceId = await client.startNew('sagaProcesarLote', { input });
    await bitacora(ctx, 'SAGA', `${instanceId.slice(0, 8)} · inicia saga ${JSON.stringify(input)}`);
    return { status: 202, jsonBody: { instanceId, estado: `/api/saga/${instanceId}` } };
  },
});

app.http('sagaEstado', {
  methods: ['GET'], authLevel: 'anonymous', route: 'saga/{instanceId}', extraInputs: [df.input.durableClient()],
  handler: async (req, ctx) => {
    const s = await df.getClient(ctx).getStatus(req.params.instanceId);
    if (!s) return { status: 404, jsonBody: { error: 'No existe esa saga' } };
    return { jsonBody: { estado: s.runtimeStatus, detalle: s.customStatus, resultado: s.output } };
  },
});

module.exports = { sagaProcesarLote, actividades, PASOS };
