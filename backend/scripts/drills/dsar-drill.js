#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * DSAR drill (Ley 21.719 Art 4-11).
 *
 * Simula end-to-end una solicitud publica de acceso del titular:
 *  1. Crea una solicitud via POST /api/public/derechos
 *  2. Verifica que se creo en BD con SLA = +30 dias
 *  3. La resuelve admin-only
 *  4. Confirma auditoria con razones del catalogo Ley 21.719
 *
 * Pre-requisitos:
 *   - Backend corriendo en localhost (puerto configurable via BACKEND_URL)
 *   - Cuenta admin (ANAMNEO_DRILL_ADMIN_EMAIL / ANAMNEO_DRILL_ADMIN_PASSWORD)
 *
 * Uso: node backend/scripts/drills/dsar-drill.js
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function main() {
  console.log('[DSAR DRILL] iniciado ' + new Date().toISOString());

  // 1) Solicitud publica
  const pubRes = await fetch(`${BACKEND_URL}/api/public/derechos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requesterName: 'Titular Drill',
      requesterEmail: 'drill@example.com',
      requestType: 'ACCESO',
      payloadRequest: 'Solicito copia de mis datos personales (drill).',
    }),
  });
  if (!pubRes.ok) {
    console.error(`[FAIL] POST /public/derechos => ${pubRes.status}`);
    process.exit(1);
  }
  const created = await pubRes.json();
  console.log(`[OK] Solicitud creada: ${created.id} due=${created.dueDate}`);

  // 2) Verificar SLA = +30 dias
  const ageDays = (new Date(created.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (Math.abs(ageDays - 30) > 1) {
    console.error(`[FAIL] SLA esperado ~30 dias, recibido ${ageDays.toFixed(2)}`);
    process.exit(1);
  }
  console.log(`[OK] SLA ${ageDays.toFixed(2)} dias`);

  // 3-4) Admin flow + auditoria: pendiente — requiere login admin.
  console.log('[INFO] Pasos 3-4 (resolve admin + verificar AuditLog) pendientes de implementacion');
  console.log('[INFO] Tip: una vez implementados, requeriran credenciales admin (DRILL_ADMIN_*).');
  console.log('[DSAR DRILL] completado parcialmente ' + new Date().toISOString());
}

main().catch((err) => {
  console.error('[DSAR DRILL] error:', err);
  process.exit(1);
});
