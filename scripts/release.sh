#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# release.sh — Empaqueta Anamneo en un zip listo para deploy
# con docker-compose.
#
# Uso:
#   npm run release
#   # Genera releases/anamneo-YYYY-MM-DD-HHMMSS.zip
#
# Deploy en servidor destino:
#   unzip anamneo-*.zip -d anamneo && cd anamneo
#   cp .env.example .env   # editar con valores reales
#   docker compose build
#   docker compose run --rm --no-deps backend npx prisma migrate deploy
#   docker compose up -d
# ============================================================

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RELEASE_DIR="$ROOT_DIR/releases"
ZIP_NAME="anamneo-${TIMESTAMP}.zip"

mkdir -p "$RELEASE_DIR"

echo "📦 Empaquetando release: $ZIP_NAME"

# Create placeholder dirs so docker-compose volume mounts work out of the box
mkdir -p runtime/data runtime/uploads

zip -r "$RELEASE_DIR/$ZIP_NAME" \
  docker-compose.yml \
  .env.example \
  package.json \
  backend/ \
  frontend/ \
  shared/ \
  scripts/dev-supervisor.sh \
  runtime/data/ \
  runtime/uploads/ \
  -x "*/node_modules/*" \
  -x "*/.next/*" \
  -x "*/dist/*" \
  -x "*/coverage/*" \
  -x "*/.git/*" \
  -x "*.db" \
  -x "*.db-*" \
  -x "*.db-journal" \
  -x "*.db-shm" \
  -x "*.db-wal" \
  -x "*.bak" \
  -x "backend/prisma/backups/*" \
  -x "backend/prisma/C:/*" \
  -x "backend/prisma/dev.db*" \
  -x "backend/prisma/dev.reset*" \
  -x "backend/uploads/*" \
  -x "frontend/out/*" \
  -x "frontend/test-results/*" \
  -x "*/.env" \
  -x "*/.env.local" \
  -x "*/.env.development" \
  -x "*/.env.production" \
  -x "releases/*" \
  -x "*.tsbuildinfo" \
  -x "*npm-debug.log*" \
  -x "*.DS_Store"

ZIP_SIZE=$(du -h "$RELEASE_DIR/$ZIP_NAME" | cut -f1)
echo ""
echo "✅ Release generado: releases/$ZIP_NAME ($ZIP_SIZE)"
echo ""
echo "📋 Para desplegar:"
echo "   1. Copiar el zip al servidor"
echo "   2. unzip $ZIP_NAME -d anamneo && cd anamneo"
echo "   3. cp .env.example .env  # editar con valores de producción"
echo "   4. docker compose build"
echo "   5. npm run deploy  # backup + migrate + restore drill + up"
echo ""
echo "   (alternativa manual sin rollback automático):"
echo "   5. docker compose run --rm --no-deps backend npx prisma migrate deploy"
echo "   6. docker compose up -d"
