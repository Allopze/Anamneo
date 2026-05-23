#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# validate-staging.sh — Validación completa de staging para Anamneo
#
# Uso:
#   ./scripts/validate-staging.sh [DOMAIN]
#
# Ejemplo:
#   ./scripts/validate-staging.sh anamneo.example.com
#
# Requisitos:
#   - cloudflared configurado y corriendo
#   - Docker stack levantado (backend + frontend)
#   - Dominio apuntando al tunnel de cloudflared
#   - .env configurado con valores de producción
# ============================================================

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Uso: $0 <domain>"
  echo "Ejemplo: $0 anamneo.example.com"
  exit 1
fi

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
echo "Validación de Staging: $DOMAIN"
echo "=========================================="
echo ""

# ── 1. Verificación de Dominio y DNS ──────────────────────────
echo "── 1. Verificación de Dominio y DNS ──"

if dig +short "$DOMAIN" >/dev/null 2>&1; then
  IP=$(dig +short "$DOMAIN" | head -1)
  pass "Dominio $DOMAIN resuelve a $IP"
else
  fail "Dominio $DOMAIN no resuelve"
fi

# ── 2. Verificación de HTTPS y Certificado ────────────────────
echo ""
echo "── 2. Verificación de HTTPS y Certificado ──"

CERT_OUTPUT=$(curl -vI "https://$DOMAIN" 2>&1)
if echo "$CERT_OUTPUT" | grep -q "SSL connection"; then
  pass "HTTPS funciona correctamente"
else
  fail "HTTPS no funciona"
fi

EXPIRE_DATE=$(echo "$CERT_OUTPUT" | grep "expire date:" | head -1)
if [[ -n "$EXPIRE_DATE" ]]; then
  pass "Certificado: $EXPIRE_DATE"
else
  warn "No se pudo obtener fecha de expiración del certificado"
fi

# ── 3. Verificación de Health Checks ──────────────────────────
echo ""
echo "── 3. Verificación de Health Checks ──"

BACKEND_HEALTH=$(curl -s "https://$DOMAIN/api/health" 2>&1)
if echo "$BACKEND_HEALTH" | jq -e '.status == "ok"' >/dev/null 2>&1; then
  pass "Backend health check: OK"
else
  fail "Backend health check: FAILED"
  echo "  Response: $BACKEND_HEALTH"
fi

DB_STATUS=$(echo "$BACKEND_HEALTH" | jq -r '.database.status' 2>/dev/null)
if [[ "$DB_STATUS" == "ok" ]]; then
  pass "Database status: OK"
else
  fail "Database status: $DB_STATUS"
fi

FRONTEND_STATUS=$(curl -sI "https://$DOMAIN" 2>&1 | head -1)
if echo "$FRONTEND_STATUS" | grep -q "200"; then
  pass "Frontend responde 200 OK"
else
  fail "Frontend no responde 200: $FRONTEND_STATUS"
fi

# ── 4. Verificación de CORS ───────────────────────────────────
echo ""
echo "── 4. Verificación de CORS ──"

CORS_OUTPUT=$(curl -sI -X OPTIONS "https://$DOMAIN/api/health" \
  -H "Origin: https://$DOMAIN" \
  -H "Access-Control-Request-Method: GET" 2>&1)

if echo "$CORS_OUTPUT" | grep -qi "access-control-allow-origin: https://$DOMAIN"; then
  pass "CORS permite origen $DOMAIN"
else
  fail "CORS no permite origen $DOMAIN"
fi

if echo "$CORS_OUTPUT" | grep -qi "access-control-allow-origin: \*"; then
  fail "CORS permite wildcard (*) - inseguro"
else
  pass "CORS no permite wildcard"
fi

# ── 5. Verificación de Cookies Seguras ────────────────────────
echo ""
echo "── 5. Verificación de Cookies Seguras ──"

LOGIN_RESPONSE=$(curl -s -c - -X POST "https://$DOMAIN/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}' 2>&1)

if echo "$LOGIN_RESPONSE" | grep -qi "set-cookie"; then
  pass "Cookies se establecen en login"
  
  if echo "$LOGIN_RESPONSE" | grep -qi "secure"; then
    pass "Cookies tienen flag Secure"
  else
    fail "Cookies NO tienen flag Secure"
  fi
  
  if echo "$LOGIN_RESPONSE" | grep -qi "httponly"; then
    pass "Cookies tienen flag HttpOnly"
  else
    fail "Cookies NO tienen flag HttpOnly"
  fi
  
  if echo "$LOGIN_RESPONSE" | grep -qi "samesite"; then
    pass "Cookies tienen flag SameSite"
  else
    warn "Cookies NO tienen flag SameSite (recomendado)"
  fi
else
  warn "No se recibieron cookies (puede ser esperado si las credenciales son inválidas)"
fi

# ── 6. Verificación de Cloudflared ────────────────────────────
echo ""
echo "── 6. Verificación de Cloudflared ──"

if command -v cloudflared >/dev/null 2>&1; then
  pass "cloudflared está instalado"
  CLOUDFLARED_VERSION=$(cloudflared --version 2>&1)
  echo "  Versión: $CLOUDFLARED_VERSION"
else
  fail "cloudflared no está instalado"
fi

if systemctl is-active --quiet cloudflared 2>/dev/null; then
  pass "cloudflared está corriendo como servicio"
else
  warn "cloudflared no está corriendo como servicio (puede estar en modo manual)"
fi

# ── 7. Verificación de Docker Stack ───────────────────────────
echo ""
echo "── 7. Verificación de Docker Stack ──"

if docker compose ps --quiet backend 2>/dev/null | grep -q .; then
  pass "Backend container está corriendo"
else
  fail "Backend container NO está corriendo"
fi

if docker compose ps --quiet frontend 2>/dev/null | grep -q .; then
  pass "Frontend container está corriendo"
else
  fail "Frontend container NO está corriendo"
fi

if docker compose ps --quiet backup-cron 2>/dev/null | grep -q .; then
  pass "Backup-cron container está corriendo"
else
  warn "Backup-cron container NO está corriendo"
fi

# ── 8. Verificación de Backups ────────────────────────────────
echo ""
echo "── 8. Verificación de Backups ──"

BACKUP_DIR="./runtime/data/backups"
if [[ -d "$BACKUP_DIR" ]]; then
  LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.dump "$BACKUP_DIR"/*.backup 2>/dev/null | head -1)
  if [[ -n "$LATEST_BACKUP" ]]; then
    BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))
    if [[ $BACKUP_AGE -lt 7 ]]; then
      pass "Último backup tiene $BACKUP_AGE horas de antigüedad"
    else
      fail "Último backup tiene $BACKUP_AGE horas de antigüedad (> 7 horas)"
    fi
    
    pass "Backup PostgreSQL detectado: $(basename "$LATEST_BACKUP")"
  else
    fail "No se encontraron backups en $BACKUP_DIR"
  fi
else
  fail "Directorio de backups no existe: $BACKUP_DIR"
fi

# ── 9. Verificación de Sentry ─────────────────────────────────
echo ""
echo "── 9. Verificación de Sentry ──"

SENTRY_DSN=$(docker compose exec backend env 2>/dev/null | grep SENTRY_DSN | cut -d= -f2-)
if [[ -n "$SENTRY_DSN" && "$SENTRY_DSN" != "" ]]; then
  pass "SENTRY_DSN está configurado en backend"
else
  warn "SENTRY_DSN no está configurado en backend"
fi

NEXT_PUBLIC_SENTRY_DSN=$(docker compose exec frontend env 2>/dev/null | grep NEXT_PUBLIC_SENTRY_DSN | cut -d= -f2-)
if [[ -n "$NEXT_PUBLIC_SENTRY_DSN" && "$NEXT_PUBLIC_SENTRY_DSN" != "" ]]; then
  pass "NEXT_PUBLIC_SENTRY_DSN está configurado en frontend"
else
  warn "NEXT_PUBLIC_SENTRY_DSN no está configurado en frontend"
fi

# ── 10. Verificación de Espacio en Disco ──────────────────────
echo ""
echo "── 10. Verificación de Espacio en Disco ──"

DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [[ $DISK_USAGE -lt 80 ]]; then
  pass "Espacio en disco: ${DISK_USAGE}% usado (< 80%)"
elif [[ $DISK_USAGE -lt 90 ]]; then
  warn "Espacio en disco: ${DISK_USAGE}% usado (>= 80%)"
else
  fail "Espacio en disco: ${DISK_USAGE}% usado (>= 90%)"
fi

# ── Resumen ───────────────────────────────────────────────────
echo ""
echo "=========================================="
echo "Resumen de Validación"
echo "=========================================="
echo -e "${GREEN}PASS: $PASS${NC}"
echo -e "${RED}FAIL: $FAIL${NC}"
echo -e "${YELLOW}WARN: $WARN${NC}"
echo ""

if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}✅ Validación exitosa - Staging está listo para producción${NC}"
  exit 0
else
  echo -e "${RED}❌ Validación fallida - $FAIL chequeos fallaron${NC}"
  exit 1
fi
