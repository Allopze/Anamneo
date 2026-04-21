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
ZIP_PATH="$RELEASE_DIR/$ZIP_NAME"

RELEASE_PATHS=(
  "docker-compose.yml"
  ".env.example"
  "README.md"
  "package.json"
  "backend/"
  "frontend/"
  "shared/"
  "scripts/deploy.sh"
)

ZIP_EXCLUDES=(
  "*/node_modules/*"
  "*/.next/*"
  "*/dist/*"
  "*/coverage/*"
  "*/.git/*"
  "*.db"
  "*.db-*"
  "*.db-journal"
  "*.db-shm"
  "*.db-wal"
  "*.bak"
  "backend/prisma/backups/*"
  "backend/prisma/C:/*"
  "backend/prisma/dev.db*"
  "backend/prisma/dev.reset*"
  "backend/uploads/*"
  "frontend/out/*"
  "frontend/test-results/*"
  "*/.env"
  "*/.env.local"
  "*/.env.development"
  "*/.env.production"
  "releases/*"
  "*.tsbuildinfo"
  "*npm-debug.log*"
  "*.DS_Store"
)

mkdir -p "$RELEASE_DIR"

echo "📦 Empaquetando release: $ZIP_NAME"

for release_path in "${RELEASE_PATHS[@]}"; do
  if [[ ! -e "$ROOT_DIR/$release_path" ]]; then
    echo "❌ Falta archivo requerido para release: $release_path" >&2
    exit 1
  fi
done

rm -f "$ZIP_PATH"

zip -r "$ZIP_PATH" "${RELEASE_PATHS[@]}" -x "${ZIP_EXCLUDES[@]}"

if ! unzip -Z1 "$ZIP_PATH" >/dev/null 2>&1; then
  echo "❌ El zip generado no se pudo validar: $ZIP_PATH" >&2
  exit 1
fi

ZIP_SIZE=$(du -h "$ZIP_PATH" | cut -f1)
echo ""
echo "✅ Release generado: releases/$ZIP_NAME ($ZIP_SIZE)"
echo ""
echo "📋 Para desplegar:"
echo "   1. Copiar el zip al servidor"
echo "   2. unzip $ZIP_NAME -d anamneo && cd anamneo"
echo "   3. mkdir -p runtime/data runtime/uploads"
echo "   4. cp .env.example .env  # editar con valores de producción"
echo "   5. docker compose build"
echo "   6. npm run deploy  # backup + migrate + restore drill + up"
echo ""
echo "   (alternativa manual sin rollback automático):"
echo "   6. docker compose run --rm --no-deps backend npx prisma migrate deploy"
echo "   7. docker compose up -d"
