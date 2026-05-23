#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Breach drill (Ley 21.719 Art 14 sexies).
 *
 * Simula end-to-end un incidente de seguridad cronometrando los hitos:
 *  1. Crear incidente (POST /api/admin/data-breaches)
 *  2. Asesar riesgo razonable
 *  3. Notificar Agencia (timestamp)
 *  4. Notificar titulares
 *  5. Cerrar con post-mortem
 *
 * Objetivo operativo: completar el flujo en <72h reales.
 *
 * Pre-requisitos:
 *   - Backend corriendo en localhost (BACKEND_URL)
 *   - Cuenta admin
 *
 * Uso: node backend/scripts/drills/breach-drill.js
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function main() {
  console.log('[BREACH DRILL] iniciado ' + new Date().toISOString());
  console.log('[INFO] Este script es un stub. Implementacion completa requiere:');
  console.log('  - Login admin (cookie auth)');
  console.log('  - Crear incidente con severity=ALTO y un patient afectado de prueba');
  console.log('  - Asesar riesgo razonable');
  console.log('  - Marcar notificado a Agencia + a titulares');
  console.log('  - Cerrar con post-mortem');
  console.log('  - Cronometrar cada hito y reportar SLA <72h');
  console.log(`  - Verificar AuditLog con razones DATA_BREACH_* via GET /api/admin/audit (BACKEND_URL=${BACKEND_URL})`);
  console.log('[BREACH DRILL] stub completado ' + new Date().toISOString());
}

main().catch((err) => {
  console.error('[BREACH DRILL] error:', err);
  process.exit(1);
});
