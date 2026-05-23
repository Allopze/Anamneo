#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

AUTO_ROLLBACK=""
for arg in "$@"; do
  case "$arg" in
    --auto-rollback) AUTO_ROLLBACK="yes" ;;
    --no-rollback) AUTO_ROLLBACK="no" ;;
  esac
done

RUNTIME_DATA="$ROOT_DIR/runtime/data"
RUNTIME_UPLOADS="$ROOT_DIR/runtime/uploads"
BACKUP_DIR="$RUNTIME_DATA/backups"
ROLLBACK_DUMP=""
ROLLBACK_UPLOADS_SNAPSHOT=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
fail() { echo -e "${RED}[deploy]${NC} $*" >&2; exit 1; }

compose_run_no_build=()
if docker compose run --help 2>&1 | grep -q -- '--no-build'; then
  compose_run_no_build+=(--no-build)
fi

if [[ ! -f "$ROOT_DIR/docker-compose.yml" ]]; then
  fail "No se encontró docker-compose.yml en $ROOT_DIR"
fi

if ! docker compose config --quiet 2>/dev/null; then
  fail "docker compose config falla. Revisa .env y docker-compose.yml"
fi

mkdir -p "$RUNTIME_DATA" "$RUNTIME_UPLOADS" "$BACKUP_DIR"

log "Asegurando imágenes y PostgreSQL..."
docker compose build
docker compose up -d postgres

log "Tomando backup PostgreSQL pre-migración..."
BACKUP_RESULT="$(docker compose run --rm --no-deps "${compose_run_no_build[@]}" \
  -e PG_BACKUP_DIR="/app/data/backups" \
  -e UPLOAD_DEST="/app/uploads" \
  backend node scripts/pg-backup.js)"

ROLLBACK_FILE="$(printf '%s' "$BACKUP_RESULT" | node -e "let data='';process.stdin.on('data',(chunk)=>data+=chunk);process.stdin.on('end',()=>{const lines=data.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);const jsonLine=[...lines].reverse().find(l=>l.startsWith('{')&&l.endsWith('}'));if(!jsonLine){process.exit(1)}const parsed=JSON.parse(jsonLine);if(!parsed.backupFile){process.exit(1)}process.stdout.write(parsed.backupFile)})")"
ROLLBACK_DUMP="$BACKUP_DIR/$ROLLBACK_FILE"

if [[ ! -f "$ROLLBACK_DUMP" ]]; then
  fail "El backup pre-migración reportó éxito pero no apareció en $ROLLBACK_DUMP"
fi

log "Backup guardado: $ROLLBACK_DUMP ($(du -h "$ROLLBACK_DUMP" | cut -f1))"

ROLLBACK_META="${ROLLBACK_DUMP}.meta.json"
if [[ -f "$ROLLBACK_META" ]]; then
  ROLLBACK_UPLOADS_RELATIVE="$(node -e "const fs=require('fs');const file=process.argv[1];const parsed=JSON.parse(fs.readFileSync(file,'utf8'));process.stdout.write(parsed.uploadsSnapshotRelativePath || '')" "$ROLLBACK_META" 2>/dev/null || true)"
  if [[ -n "$ROLLBACK_UPLOADS_RELATIVE" ]]; then
    ROLLBACK_UPLOADS_SNAPSHOT="$BACKUP_DIR/$ROLLBACK_UPLOADS_RELATIVE"
    [[ -d "$ROLLBACK_UPLOADS_SNAPSHOT" ]] && log "Snapshot de uploads para rollback: $ROLLBACK_UPLOADS_SNAPSHOT"
  fi
fi

log "Ejecutando restore drill sobre el backup pre-migración..."
docker compose run --rm --no-deps "${compose_run_no_build[@]}" \
  -e PG_BACKUP_DIR="/app/data/backups" \
  -e UPLOAD_DEST="/app/uploads" \
  backend node scripts/pg-restore-drill.js --from="/app/data/backups/$(basename "$ROLLBACK_DUMP")"

log "Ejecutando prisma migrate deploy..."
if docker compose run --rm --no-deps "${compose_run_no_build[@]}" backend npx prisma migrate deploy; then
  log "Migraciones aplicadas correctamente."
else
  echo ""
  echo -e "${RED}═══════════════════════════════════════════════════${NC}"
  echo -e "${RED}  MIGRACIÓN FALLÓ${NC}"
  echo -e "${RED}═══════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${YELLOW}Rollback disponible. Para restaurar el estado previo:${NC}"
  echo "  docker compose down"
  echo "  docker compose up -d postgres"
  echo "  docker compose run --rm --no-deps backend pg_restore --clean --if-exists --no-owner --no-privileges --dbname=\"\$MIGRATION_DATABASE_URL\" \"/app/data/backups/$(basename "$ROLLBACK_DUMP")\""
  if [[ -n "$ROLLBACK_UPLOADS_SNAPSHOT" ]]; then
    echo "  rm -rf \"$RUNTIME_UPLOADS\" && mkdir -p \"$RUNTIME_UPLOADS\" && cp -a \"$ROLLBACK_UPLOADS_SNAPSHOT\"/. \"$RUNTIME_UPLOADS\"/"
  fi

  DO_ROLLBACK=""
  if [[ "$AUTO_ROLLBACK" == "yes" ]]; then
    DO_ROLLBACK="yes"
  elif [[ "$AUTO_ROLLBACK" == "no" || ! -t 0 ]]; then
    DO_ROLLBACK="no"
  else
    read -r -p "¿Ejecutar rollback automático ahora? [s/N] " REPLY
    [[ "$REPLY" =~ ^[sS]$ ]] && DO_ROLLBACK="yes" || DO_ROLLBACK="no"
  fi

  if [[ "$DO_ROLLBACK" == "yes" ]]; then
    docker compose down 2>/dev/null || true
    docker compose up -d postgres
    docker compose run --rm --no-deps "${compose_run_no_build[@]}" backend sh -c \
      'pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$MIGRATION_DATABASE_URL" "$1"' \
      sh "/app/data/backups/$(basename "$ROLLBACK_DUMP")"
    if [[ -n "$ROLLBACK_UPLOADS_SNAPSHOT" && -d "$ROLLBACK_UPLOADS_SNAPSHOT" ]]; then
      rm -rf "$RUNTIME_UPLOADS"
      mkdir -p "$RUNTIME_UPLOADS"
      cp -a "$ROLLBACK_UPLOADS_SNAPSHOT"/. "$RUNTIME_UPLOADS"/
      log "Uploads restaurados desde $ROLLBACK_UPLOADS_SNAPSHOT"
    fi
    docker compose up -d
    fail "Rollback completado tras falla de migración. Revisa logs antes de reintentar."
  fi

  fail "Migración falló. Deploy abortado."
fi

log "Levantando servicios..."
docker compose up -d

log "Esperando health check del backend..."
TRIES=0
MAX_TRIES=30
while [[ $TRIES -lt $MAX_TRIES ]]; do
  if docker compose exec -T backend wget -q --spider http://127.0.0.1:5679/api/health 2>/dev/null; then
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

log "Deploy completado."
