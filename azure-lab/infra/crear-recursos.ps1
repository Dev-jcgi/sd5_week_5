# Versión para Windows PowerShell de crear-recursos.sh (requiere Azure CLI y `az login`).
#   .\infra\crear-recursos.ps1
#   .\infra\crear-recursos.ps1 -Loc westus3
param([string]$RG = "rg-pixpro-sd5", [string]$Loc = "eastus", [string]$Suf = (Get-Random -Minimum 1000 -Maximum 9999))
$ErrorActionPreference = "Continue"  # az escribe avisos en stderr; revisamos $LASTEXITCODE
$ST = "stpixpro$Suf"; $SB = "sb-pixpro-$Suf"; $COSMOS = "cosmos-pixpro-$Suf"
$Dir = Split-Path -Parent $PSScriptRoot

Write-Host ">> Suscripción: $(az account show --query name -o tsv) - Grupo: $RG - Región: $Loc"
foreach ($p in "Microsoft.Storage","Microsoft.ServiceBus","Microsoft.DocumentDB") { az provider register --namespace $p --wait | Out-Null }
az group create -n $RG -l $Loc -o none

Write-Host ">> Storage"
az storage account create -n $ST -g $RG -l $Loc --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false -o none
$ST_CONN = az storage account show-connection-string -n $ST -g $RG --query connectionString -o tsv

Write-Host ">> Service Bus Basic + colas"
az servicebus namespace create -n $SB -g $RG -l $Loc --sku Basic -o none
foreach ($q in "pixpro-eventos","pixpro-trabajos") { az servicebus queue create -n $q --namespace-name $SB -g $RG --max-delivery-count 3 -o none }
$SB_CONN = az servicebus namespace authorization-rule keys list -n RootManageSharedAccessKey --namespace-name $SB -g $RG --query primaryConnectionString -o tsv

Write-Host ">> Cosmos DB (gratuita o serverless)"
$thr = @()
az cosmosdb create -n $COSMOS -g $RG --locations regionName=$Loc failoverPriority=0 isZoneRedundant=False --enable-free-tier true --default-consistency-level Session -o none 2>$null
if ($LASTEXITCODE -eq 0) { $thr = @("--throughput","400"); Write-Host "   OK capa gratuita" }
else {
  az cosmosdb create -n $COSMOS -g $RG --locations regionName=$Loc failoverPriority=0 isZoneRedundant=False --capabilities EnableServerless --default-consistency-level Session -o none
  Write-Host "   OK serverless"
}
az cosmosdb sql database create -a $COSMOS -g $RG -n pixpro -o none
az cosmosdb sql container create -a $COSMOS -g $RG -d pixpro -n lotes --partition-key-path /loteId @thr -o none
$COSMOS_CONN = az cosmosdb keys list -n $COSMOS -g $RG --type connection-strings --query "connectionStrings[0].connectionString" -o tsv

$settings = [ordered]@{
  IsEncrypted = $false
  Values = [ordered]@{
    FUNCTIONS_WORKER_RUNTIME = "node"; AzureWebJobsFeatureFlags = "EnableWorkerIndexing"
    AzureWebJobsStorage = $ST_CONN; StorageConnection = $ST_CONN
    CosmosDBConnection = $COSMOS_CONN; ServiceBusConnection = $SB_CONN
  }
  Host = @{ CORS = "*" }
}
$settings | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $Dir "local.settings.json")
Write-Host "`nLISTO: local.settings.json creado. Siguiente: npm install; func start -> http://localhost:7071/api/panel"
