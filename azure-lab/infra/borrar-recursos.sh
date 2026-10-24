#!/usr/bin/env bash
# Borra TODO lo del laboratorio (el grupo de recursos completo) para no gastar crédito.
set -euo pipefail
RG="${RG:-rg-pixpro-sd5}"
echo "Se borrará el grupo de recursos '$RG' y todo lo que contiene."
az group delete -n "$RG" --yes --no-wait
echo "✅ Borrado en curso (tarda unos minutos). Verifica en el portal: Grupos de recursos."
