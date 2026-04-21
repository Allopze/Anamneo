#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# deploy.sh — Despliegue de Anamneo con backup pre-migración,
# restore drill post-backup y rollback automatizado.
#
# Uso:
#   ./scripts/deploy.sh
#
# Requisitos:
#   - docker compose disponible
#   - .env configurado con valores de producción
#   - Imágenes ya buildeadas (docker compose build)
#
# Flujo:
#   1. Verifica que las imágenes estén buildeadas
#   2. Toma backup pre-migración de la DB y uploads
#   3. Ejecuta restore drill sobre el backup
#   4. Ejecuta prisma migrate deploy
#   5. Si la migración falla, ofrece rollback automático
#   6. Levanta los servicios
# ============================================================

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

RUNTIME_DATA="$ROOT_DIR/runtime/data"
RUNTIME_UPLOADS="$ROOT_DIR/runtime/uploads"
BACKUP_DIR="$RUNTIME_DATA/backups"
DB_PATH="$RUNTIME_DATA/anamneo.db"
ROLLBACK_DB=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
fail() { echo -e "${RED}[deploy]${NC} $*" >&2; exit 1; }

# ── 0. Preconditions ─────────────────────────────────────────

if [[ ! -f "$ROOT_DIR/docker-compose.yml" ]]; then
  fail "No se encontró docker-compose.yml en $ROOT_DIR"
fi

if ! docker compose config --quiet 2>/dev/null; then
  fail "docker compose config falla. Revisa .env y docker-compose.yml"
fi

# ── 1. Pre-migration backup ──────────────────────────────────

mkdir -p "$RUNTIME_DATA" "$RUNTIME_UPLOADS"
mkdir -p "$BACKUP_DIR"

if [[ -f "$DB_PATH" ]]; then
  log "Tomando backup pre-migración con sqlite-backup.js..."
  BACKUP_RESULT="$(docker compose run --rm --no-deps \
    -e DATABASE_URL="file:/app/data/anamneo.db" \
    -e SQLITE_BACKUP_DIR="/app/data/backups" \
    -e UPLOAD_DEST="/app/uploads" \
    backend node scripts/sqlite-backup.js)"

  ROLLBACK_FILE="$(printf '%s' "$BACKUP_RESULT" | node -e "let data='';process.stdin.on('data',(chunk)=>data+=chunk);process.stdin.on('end',()=>{const parsed=JSON.parse(data);if(!parsed.backupFile){process.exit(1)}process.stdout.write(parsed.backupFile)})")"
  ROLLBACK_DB="$BACKUP_DIR/$ROLLBACK_FILE"

  if [[ ! -f "$ROLLBACK_DB" ]]; then
    fail "El backup pre-migración reportó éxito pero no apareció en $ROLLBACK_DB"
  fi

  DB_SIZE=$(du -h "$ROLLBACK_DB" | cut -f1)
  log "Backup guardado: $ROLLBACK_DB ($DB_SIZE)"
else
  warn "No existe $DB_PATH — primera instalación, no se requiere backup."
fi

# ── 2. Restore drill on the backup ───────────────────────────

if [[ -f "$ROLLBACK_DB" ]]; then
  log "Ejecutando restore drill sobre el backup pre-migración..."
  if docker compose run --rm --no-deps \
    -e DATABASE_URL="file:/app/data/anamneo.db" \
    -e SQLITE_BACKUP_DIR="/app/data/backups" \
    -e UPLOAD_DEST="/app/uploads" \
    backend node scripts/sqlite-restore-drill.js --from="/app/data/backups/$(basename "$ROLLBACK_DB")"; then
    log "Restore drill pasó — el backup es válido."
  else
    fail "Restore drill falló sobre el backup pre-migración. Abortando deploy."
  fi
fi

# ── 3. Run migrations ────────────────────────────────────────

log "Ejecutando prisma migrate deploy..."
if docker compose run --rm --no-deps backend npx prisma migrate deploy; then
  log "Migraciones aplicadas correctamente."
else
  echo ""
  echo -e "${RED}═══════════════════════════════════════════════════${NC}"
  echo -e "${RED}  MIGRACIÓN FALLÓ${NC}"
  echo -e "${RED}═══════════════════════════════════════════════════${NC}"
  echo ""

  if [[ -f "$ROLLBACK_DB" ]]; then
    echo -e "${YELLOW}Rollback disponible. Para restaurar el estado previo:${NC}"
    echo ""
    echo "  docker compose down"
    echo "  cp \"$ROLLBACK_DB\" \"$DB_PATH\""
    echo "  docker compose up -d"
    echo ""
    read -r -p "¿Ejecutar rollback automático ahora? [s/N] " REPLY
    if [[ "$REPLY" =~ ^[sS]$ ]]; then
      docker compose down 2>/dev/null || true
      cp "$ROLLBACK_DB" "$DB_PATH"
      log "Base restaurada desde $ROLLBACK_DB"
      log "Levantando servicios con estado anterior..."
      docker compose up -d
      log "Rollback completado. Verifica el estado del sistema."
      exit 1
    fi
  fi

  fail "Migración falló. Deploy abortado."
fi

# ── 4. Start services ────────────────────────────────────────

log "Levantando servicios..."
docker compose up -d

log "Esperando health check del backend..."
TRIES=0
MAX_TRIES=30
while [[ $TRIES -lt $MAX_TRIES ]]; do
  if docker compose exec -T backend wget -q --spider http://127.0.0.1:5678/api/health 2>/dev/null; then
    break
  fi
  TRIES=$((TRIES + 1))
  sleep 2
done

if [[ $TRIES -ge $MAX_TRIES ]]; then
  warn "Backend no respondió al health check después de ${MAX_TRIES} intentos."
  warn "Verifica los logs: docker compose logs backend"
  exit 1
fi

log "Backend healthy."

# ── 5. Post-deploy summary ───────────────────────────────────

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  DEPLOY COMPLETADO${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  Backup pre-migración: $ROLLBACK_DB"
echo "  Servicios:            docker compose ps"
echo "  Logs:                 docker compose logs -f"
echo "  Health:               curl http://127.0.0.1:5678/api/health"
echo ""

if [[ -f "$ROLLBACK_DB" ]]; then
  echo -e "  ${YELLOW}Si necesitas rollback:${NC}"
  echo "    docker compose down"
  echo "    cp \"$ROLLBACK_DB\" \"$DB_PATH\""
  echo "    docker compose up -d"
  echo ""
fi
