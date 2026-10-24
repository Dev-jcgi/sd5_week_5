#!/usr/bin/env bash
# Crea los recursos de Azure del laboratorio (≈ 8–12 min, casi todo es Cosmos DB).
# Úsalo en Azure Cloud Shell (Bash) o en tu terminal con Azure CLI (`az login` primero).
#
#   bash infra/crear-recursos.sh                 # región por defecto: eastus
#   LOC=westus3 bash infra/crear-recursos.sh     # si tu suscripción de estudiante no permite eastus
#
# Costo estimado para la clase: < 1 USD (Cosmos DB en capa gratuita o serverless,
# Service Bus Basic, Storage Standard LRS). Al terminar: bash infra/borrar-recursos.sh
set -euo pipefail

RG="${RG:-rg-pixpro-sd5}"
LOC="${LOC:-eastus}"
SUF="${SUF:-$(printf '%04d' $((RANDOM % 10000)))}"
ST="stpixpro${SUF}"
SB="sb-pixpro-${SUF}"
COSMOS="cosmos-pixpro-${SUF}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ Suscripción: $(az account show --query name -o tsv)"
echo "▶ Grupo: $RG · Región: $LOC · Sufijo: $SUF"

echo "▶ Registrando proveedores (solo la primera vez tarda)…"
for p in Microsoft.Storage Microsoft.ServiceBus Microsoft.DocumentDB; do az provider register --namespace "$p" --wait >/dev/null; done

echo "▶ Grupo de recursos"
az group create -n "$RG" -l "$LOC" -o none

echo "▶ Storage (Table Storage para event store, bitácora e idempotencia; también lo usa Durable Functions)"
az storage account create -n "$ST" -g "$RG" -l "$LOC" --sku Standard_LRS --kind StorageV2 \
  --min-tls-version TLS1_2 --allow-blob-public-access false -o none
ST_CONN=$(az storage account show-connection-string -n "$ST" -g "$RG" --query connectionString -o tsv)

echo "▶ Service Bus Basic + colas (maxDeliveryCount = 3 → luego DLQ)"
az servicebus namespace create -n "$SB" -g "$RG" -l "$LOC" --sku Basic -o none
for q in pixpro-eventos pixpro-trabajos; do
  az servicebus queue create -n "$q" --namespace-name "$SB" -g "$RG" --max-delivery-count 3 -o none
done
SB_CONN=$(az servicebus namespace authorization-rule keys list -n RootManageSharedAccessKey \
  --namespace-name "$SB" -g "$RG" --query primaryConnectionString -o tsv)

echo "▶ Cosmos DB (intenta la capa GRATUITA; si ya la usaste en esta suscripción, crea una SERVERLESS)"
THR=""
if az cosmosdb create -n "$COSMOS" -g "$RG" --locations regionName="$LOC" failoverPriority=0 isZoneRedundant=False \
     --enable-free-tier true --default-consistency-level Session -o none 2>/dev/null; then
  THR="--throughput 400"; echo "   ✓ capa gratuita (1000 RU/s y 25 GB sin costo)"
else
  az cosmosdb create -n "$COSMOS" -g "$RG" --locations regionName="$LOC" failoverPriority=0 isZoneRedundant=False \
     --capabilities EnableServerless --default-consistency-level Session -o none
  echo "   ✓ serverless (pagas centavos por uso)"
fi
az cosmosdb sql database create -a "$COSMOS" -g "$RG" -n pixpro -o none
# shellcheck disable=SC2086
az cosmosdb sql container create -a "$COSMOS" -g "$RG" -d pixpro -n lotes --partition-key-path /loteId $THR -o none
COSMOS_CONN=$(az cosmosdb keys list -n "$COSMOS" -g "$RG" --type connection-strings \
  --query "connectionStrings[0].connectionString" -o tsv)

cat > "$DIR/local.settings.json" <<JSON
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsFeatureFlags": "EnableWorkerIndexing",
    "AzureWebJobsStorage": "$ST_CONN",
    "StorageConnection": "$ST_CONN",
    "CosmosDBConnection": "$COSMOS_CONN",
    "ServiceBusConnection": "$SB_CONN"
  },
  "Host": { "CORS": "*" }
}
JSON

echo
echo "✅ Listo. Se escribió $DIR/local.settings.json"
echo "   (Si corriste esto en Cloud Shell, descarga ese archivo o copia su contenido a tu máquina.)"
echo "   Siguiente paso:  npm install  &&  func start   →  abre http://localhost:7071/api/panel"
echo "   NO subas local.settings.json a Git: contiene llaves. Ya está en .gitignore."
