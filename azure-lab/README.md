# Laboratorio PixPro en Azure · EDA 2

Práctica de la Semana 5 de Desarrollo de Software 5: **Event Sourcing, Outbox + CDC, SAGA y resiliencia** con ejemplos muy pequeños sobre el capstone PixPro.

Todo es **Node.js + Azure Functions** y se proyecta desde un panel web (`/api/panel`) con una bitácora en vivo.

```
              ┌──────────── Demo 1 · Event Sourcing ─────────────┐
 Panel  ───►  │ HTTP → Table Storage (eventos) → replay / snapshot│
 (web)        └──────────────────────────────────────────────────┘
              ┌──────────── Demo 2 · Outbox + CDC ───────────────────────────────────────┐
        ───►  │ HTTP → Cosmos DB (lote + outbox en UNA transacción) → Change Feed (CDC) │
              │      → Service Bus "pixpro-eventos" → notifier idempotente              │
              └──────────────────────────────────────────────────────────────────────────┘
              ┌──────────── Demo 3 · SAGA orquestada ─────────────────────────┐
        ───►  │ Durable Functions: créditos → IA (reintentos) → CDN → notificar│
              │ falla permanente → compensaciones en orden inverso            │
              └───────────────────────────────────────────────────────────────┘
              ┌──────────── Demo 4 · Resiliencia ──────────────────────────────────────┐
        ───►  │ backoff + jitter · circuit breaker · Service Bus "pixpro-trabajos" → DLQ│
              └────────────────────────────────────────────────────────────────────────┘
 Demo 5 (sin Azure): scripts de particionamiento/hotspots, latencia por lotes y versionado de esquemas
```

| Demo | Tema de la semana | Servicios | ¿Necesita Azure? |
|---|---|---|---|
| 1 | Almacenar y reproducir eventos | Table Storage | No (Azurite) |
| 2 | Bandeja de salida y CDC | Cosmos DB + Service Bus | **Sí** |
| 3 | Patrón SAGA y coordinación de flujos | Durable Functions | No (Azurite) |
| 4 | Manejo de errores (reintentos, circuit breaker, DLQ) | Service Bus | Solo la parte de DLQ |
| 5 | Flujo de eventos, latencia, particiones y versionado | Node puro | No |

---

## 1. Requisitos (una sola vez, ~20 min)

1. **Cuenta Azure for Students** activa: <https://azure.microsoft.com/free/students> (100 USD de crédito, sin tarjeta).
2. **Node.js 22 LTS**: <https://nodejs.org>. Comprueba con `node -v`.
3. **Azure CLI**: <https://learn.microsoft.com/cli/azure/install-azure-cli>. Comprueba con `az version`.
   *Alternativa sin instalar nada:* usa **Azure Cloud Shell** (botón `>_` arriba en el portal) solo para crear los recursos.
4. **Azure Functions Core Tools v4** (el comando `func`):
   - Windows: `winget install Microsoft.Azure.FunctionsCoreTools`
   - macOS: `brew tap azure/functions && brew install azure-functions-core-tools@4`
   - Cualquier sistema: `npm i -g azure-functions-core-tools@4 --unsafe-perm true`
   Comprueba con `func --version` (debe empezar con 4).
5. Recomendado: VS Code con la extensión **Azure Functions** y **REST Client**.

## 2. Ruta rápida SIN Azure (Demos 1, 3, 4a y 5) — ~5 min

```bash
cd azure-lab
npm install
cp local.settings.example.json local.settings.json    # Windows: copy local.settings.example.json local.settings.json
npm run azurite          # TERMINAL 1: emulador local de Storage (déjalo abierto)
func start               # TERMINAL 2
```

Abre **<http://localhost:7071/api/panel>**. El encabezado dirá `Azure: Cosmos — · Service Bus —`: es normal en esta ruta.

## 3. Ruta completa CON Azure (todas las demos) — ~15 min

```bash
az login                                   # elige la suscripción "Azure for Students"
az account show --query name -o tsv        # confirma que es la correcta
bash infra/crear-recursos.sh               # Linux/macOS/Cloud Shell
# Windows PowerShell:  .\infra\crear-recursos.ps1
```

El script crea en el grupo `rg-pixpro-sd5`:

| Recurso | Para qué | Costo aproximado |
|---|---|---|
| Storage Account (Standard LRS) | event store, bitácora, idempotencia, estado de Durable | centavos |
| Service Bus **Basic** + colas `pixpro-eventos` y `pixpro-trabajos` (maxDeliveryCount = 3) | broker y DLQ | ~0.05 USD por millón de operaciones |
| Cosmos DB **capa gratuita** (o serverless si ya usaste la gratuita) con BD `pixpro` y contenedor `lotes` (partición `/loteId`) | outbox + change feed (CDC) | 0 USD en capa gratuita |

Al final escribe `local.settings.json` con las cadenas de conexión. **No lo subas a Git** (ya está en `.gitignore`).
Si lo corriste en Cloud Shell, descarga el archivo (botón *Administrar archivos → Descargar*) y ponlo en `azure-lab/`.

Luego:

```bash
npm install
func start
```

Abre <http://localhost:7071/api/panel>: ahora dirá `Azure: Cosmos ✓ · Service Bus ✓`.

> **Región bloqueada.** Si ves `RequestDisallowedByAzure` o `RequestDisallowedByPolicy`, tu suscripción de estudiante solo permite ciertas regiones. Prueba `LOC=westus3 bash infra/crear-recursos.sh` (o `-Loc westus3` en PowerShell), o consulta las permitidas en *Portal → Directivas → Allowed locations*.

---

## 4. Guion de las demos en clase

Cada demo dura 3–5 minutos. Ten el panel a la izquierda y la bitácora a la derecha.

### Demo 1 · Almacenar y reproducir eventos (Event Sourcing)

1. **Cargar 6 eventos de ejemplo** → aparecen `v1 LoteCreado … v6 LoteCompletado`.
2. Mueve el control **Hasta la versión** de 6 a 0: el estado se recalcula. *Mensaje: el estado no se guarda; es una consecuencia de los eventos.*
3. **Tomar snapshot** y luego **Agregar evento** → **Reconstruir**: la respuesta dice `desdeSnapshot` y cuántos eventos se aplicaron. *Snapshots = reconstrucción rápida.*
4. **Simular escritura concurrente**: dos escritores leen la v1 y escriben la v2 al mismo tiempo; uno recibe **201** y el otro **409**. *Concurrencia optimista: Table Storage rechaza la fila repetida (PartitionKey = lote, RowKey = versión).*

Para mirar los datos: VS Code → extensión Azure → Storage → Tables → `eventos` (o Azure Storage Explorer).

### Demo 2 · Bandeja de salida (Outbox) + CDC

1. **Dual write con broker caído** → responde 500: el lote quedó en la BD pero el evento se perdió. *Este es el problema.*
2. **Crear lote con Outbox** → en la bitácora: `OUTBOX` (lote + evento en una sola transacción) → `CDC` (el Change Feed lo publica y marca `enviado=true`) → `NOTIFIER` (lo consume). Puede tardar ~5 s.
3. **Ver lote y outbox** → el evento tiene `enviado: true`.
4. **Cambio legado (CDC)** → una app cambia el estado sin publicar nada; el Change Feed lo detecta y publica `cdc.LoteActualizado`. *Eso es CDC: el log de cambios de la BD se vuelve evento.*
5. **Reenviar (duplicado)** → el notifier escribe `DUPLICADO ignorado`. *Outbox garantiza "al menos una vez" → los consumidores deben ser idempotentes.*

### Demo 3 · SAGA orquestada con compensaciones

1. Falla en **ninguno** → los 4 pasos en verde: `COMPLETADO`.
2. **Fallas temporales: 2** → el paso `procesarImagenes` falla dos veces y Durable reintenta a 1 s y 2 s (backoff) antes de completar.
3. Falla en **CDN** → `publicarCdn` en rojo; se ejecutan `descartarResultados` y `liberarCreditos` (orden inverso): `COMPENSADO`.
4. Falla en **IA** → los reintentos se agotan (~7 s) y solo se compensa `liberarCreditos`.

*Mensaje: sin 2PC ni bloqueos; cada paso tiene su acción inversa y un orquestador central lleva el control. La alternativa es la coreografía: cada servicio reacciona a eventos del anterior (se explica en las diapositivas).*

### Demo 4 · Reintentos, circuit breaker y DLQ

1. IA **intermitente** → **Procesar imagen** varias veces: verás `#1 ✗ … espera 180 ms | #2 ✗ … | #3 ok`.
2. IA **caída** → tras 3 fallos el circuito pasa a `ABIERTO` y las siguientes llamadas fallan **al instante** (fallback). A los 15 s pasa a `MEDIO_ABIERTO` y prueba de nuevo.
3. (Con Azure) **Mensaje veneno** → el digester falla 3 veces (`entrega 1 de 3`, `2 de 3`, `3 de 3`) y Service Bus lo manda a la **DLQ**. **Ver DLQ** muestra el motivo `MaxDeliveryCountExceeded`. **Corregir y reprocesar** lo devuelve a la cola.

### Demo 5 · Flujo de eventos, latencia y particiones (terminal)

```bash
npm run demo:latencia      # uno por uno vs. lotes vs. lotes en paralelo
npm run demo:particiones   # región, userId, loteId y "sal" → ¿dónde hay hotspot?
npm run demo:versionado    # compatibilidad hacia atrás (upcaster) y hacia adelante (lector tolerante)
npm run demo:replay        # Event Sourcing en memoria, sin Azure
```

---

## 5. Pruebas

```bash
npm test                   # lógica pura + SAGA con un motor de prueba
npm run azurite & npm test # además prueba el event store contra Azurite
```

## 6. Problemas comunes

| Síntoma | Solución |
|---|---|
| `func: command not found` | Instala Core Tools v4 (paso 1.4) y abre una terminal nueva. |
| `connect ECONNREFUSED 127.0.0.1:10000/10001/10002` | Azurite no está corriendo: `npm run azurite` en otra terminal. |
| Demo 2 no muestra `CDC` | Espera 5–10 s; revisa que `func start` diga `cdcRelay: cosmosDBTrigger`. Si no aparece, falta `CosmosDBConnection`. |
| `The free tier discount is already applied…` | Normal si ya usaste la capa gratuita: el script crea una cuenta serverless. |
| `MessagingEntityNotFound` | La cola no existe: vuelve a correr el script o créala en el portal. |
| Puerto 7071 ocupado | `func start --port 7072` y abre `/api/panel` en ese puerto. |
| Los cambios en el código no aparecen | Detén `func start` (Ctrl+C) y vuelve a iniciarlo. |

## 7. Limpieza (¡importante!)

```bash
bash infra/borrar-recursos.sh    # o: az group delete -n rg-pixpro-sd5 --yes
```

Borra el grupo completo. Revisa *Portal → Cost Management* al día siguiente: debe marcar centavos.

## 8. (Opcional) Desplegar en Azure en lugar de correr local

```bash
APP=func-pixpro-$RANDOM
ST=$(az storage account list -g rg-pixpro-sd5 --query "[0].name" -o tsv)
az functionapp create -g rg-pixpro-sd5 -n $APP --storage-account $ST \
  --flexconsumption-location eastus --runtime node --runtime-version 22
func azure functionapp publish $APP --publish-local-settings -i   # sube también las cadenas de conexión
# Panel: https://$APP.azurewebsites.net/api/panel
```

## 9. Cómo se conecta con PixPro (para el capstone)

- **Event store** → historial auditable de cada lote (quién subió, qué filtros, qué falló) y reconstrucción si un consumidor tuvo un bug.
- **Outbox** → la API guarda el lote y `ImageUploaded` juntos; nada se pierde si RabbitMQ/Service Bus está caído.
- **CDC** → integrar sistemas que no emiten eventos (IAM, facturación) leyendo su log de cambios.
- **SAGA** → créditos ↔ procesamiento ↔ CDN ↔ notificación, con compensaciones.
- **Resiliencia** → reintentos con backoff hacia la IA, circuit breaker para no saturarla y DLQ para imágenes corruptas: insumo directo de la **Actividad #1**.
