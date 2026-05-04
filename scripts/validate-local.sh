#!/usr/bin/env bash
set -uo pipefail

# ============================================================
# validate-local.sh — Validación rápida del entorno local
#
# Uso:
#   ./scripts/validate-local.sh
#
# Verifica:
#   - Backend health check
#   - Frontend health check
#   - Base de datos integridad
#   - Backups recientes
#   - Espacio en disco
#   - Servicios Docker (si están corriendo)
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "${GREEN}[PASS]${NC} $*"; ((PASS++)); }
fail() { echo -e "${RED}[FAIL]${NC} $*"; ((FAIL++)); }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; ((WARN++)); }

echo "=========================================="
echo "Validación Local — Anamneo"
echo "=========================================="
echo ""

# ── 1. Backend Health Check ───────────────────────────────────
echo "── 1. Backend Health Check ──"

# Get backend health - filter out Prisma logs
BACKEND_HEALTH_JSON=$(curl -s http://localhost:5678/api/health 2>/dev/null | grep -o '{.*}' | head -1 || echo "FAILED")
if echo "$BACKEND_HEALTH_JSON" | jq -e '.status == "ok"' >/dev/null 2>&1; then
  pass "Backend responde correctamente"
  DB_STATUS=$(echo "$BACKEND_HEALTH_JSON" | jq -r '.database.status' 2>/dev/null)
  if [[ "$DB_STATUS" == "ok" ]]; then
    pass "Database status: OK"
  else
    fail "Database status: $DB_STATUS"
  fi
else
  fail "Backend no responde en http://localhost:5678/api/health"
  echo "  Response: $BACKEND_HEALTH_JSON"
fi

# ── 2. Frontend Health Check ──────────────────────────────────
echo ""
echo "── 2. Frontend Health Check ──"

FRONTEND_STATUS=$(curl -sI --connect-timeout 2 --max-time 3 http://localhost:5555 2>/dev/null | head -1 || echo "FAILED")
if echo "$FRONTEND_STATUS" | grep -q "200\|301\|302"; then
  pass "Frontend responde en http://localhost:5555"
else
  # Try common Next.js dev port
  FRONTEND_STATUS_3000=$(curl -sI --connect-timeout 2 --max-time 3 http://localhost:3000 2>/dev/null | head -1 || echo "FAILED")
  if echo "$FRONTEND_STATUS_3000" | grep -q "200\|301\|302"; then
    pass "Frontend responde en http://localhost:3000"
  else
    warn "Frontend no está corriendo en puertos comunes (5555, 3000)"
  fi
fi

# ── 3. Base de Datos Integridad ───────────────────────────────
echo ""
echo "── 3. Base de Datos Integridad ──"

DB_PATH="./backend/prisma/dev.db"
if [[ -f "$DB_PATH" ]]; then
  INTEGRITY=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>&1)
  if [[ "$INTEGRITY" == "ok" ]]; then
    pass "Integridad de base de datos: OK"
  else
    fail "Integridad de base de datos: FAILED ($INTEGRITY)"
  fi
  
  DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
  echo "  Tamaño: $DB_SIZE"
else
  warn "Base de datos no encontrada en $DB_PATH"
fi

# ── 4. Backups Recientes ──────────────────────────────────────
echo ""
echo "── 4. Backups Recientes ──"

BACKUP_DIR="./backend/prisma/backups"
if [[ -d "$BACKUP_DIR" ]]; then
  BACKUP_COUNT=$(ls "$BACKUP_DIR"/*.db 2>/dev/null | wc -l)
  if [[ $BACKUP_COUNT -gt 0 ]]; then
    pass "$BACKUP_COUNT backups encontrados"
    
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.db 2>/dev/null | head -1)
    BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 60 ))
    echo "  Último backup: $BACKUP_AGE minutos atrás"
    
    BACKUP_INTEGRITY=$(sqlite3 "$LATEST_BACKUP" "PRAGMA integrity_check;" 2>&1)
    if [[ "$BACKUP_INTEGRITY" == "ok" ]]; then
      pass "Integridad del último backup: OK"
    else
      fail "Integridad del último backup: FAILED"
    fi
  else
    warn "No hay backups en $BACKUP_DIR"
  fi
else
  warn "Directorio de backups no existe: $BACKUP_DIR"
fi

# ── 5. Espacio en Disco ───────────────────────────────────────
echo ""
echo "── 5. Espacio en Disco ──"

DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [[ $DISK_USAGE -lt 80 ]]; then
  pass "Espacio en disco: ${DISK_USAGE}% usado (< 80%)"
elif [[ $DISK_USAGE -lt 90 ]]; then
  warn "Espacio en disco: ${DISK_USAGE}% usado (>= 80%)"
else
  fail "Espacio en disco: ${DISK_USAGE}% usado (>= 90%)"
fi

# ── 6. Servicios Docker ───────────────────────────────────────
echo ""
echo "── 6. Servicios Docker ──"

if command -v docker &>/dev/null && docker compose ps --quiet 2>/dev/null | grep -q .; then
  pass "Docker Compose está corriendo"
  docker compose ps 2>/dev/null | tail -n +2 | while read -r line; do
    echo "  $line"
  done
else
  warn "Docker Compose no está corriendo (modo desarrollo local)"
fi

# ── 7. Git Status ─────────────────────────────────────────────
echo ""
echo "── 7. Git Status ──"

if git status --porcelain 2>/dev/null | grep -q .; then
  CHANGED=$(git status --porcelain 2>/dev/null | wc -l)
  warn "$CHANGED archivos modificados sin commitear"
  git status --porcelain 2>/dev/null | head -10 | while read -r line; do
    echo "  $line"
  done
else
  pass "Working directory limpio"
fi

# ── 8. Dependencias ───────────────────────────────────────────
echo ""
echo "── 8. Dependencias ──"

if [[ -d "backend/node_modules" ]]; then
  pass "Backend dependencies instaladas"
else
  warn "Backend dependencies no instaladas (ejecutar: cd backend && npm install)"
fi

if [[ -d "frontend/node_modules" ]]; then
  pass "Frontend dependencies instaladas"
else
  warn "Frontend dependencies no instaladas (ejecutar: cd frontend && npm install)"
fi

# ── Resumen ───────────────────────────────────────────────────
echo ""
echo "=========================================="
echo "Resumen de Validación Local"
echo "=========================================="
echo -e "${GREEN}PASS: $PASS${NC}"
echo -e "${RED}FAIL: $FAIL${NC}"
echo -e "${YELLOW}WARN: $WARN${NC}"
echo ""

if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}✅ Validación local exitosa${NC}"
  exit 0
else
  echo -e "${RED}❌ Validación local fallida - $FAIL chequeos fallaron${NC}"
  exit 1
fi
