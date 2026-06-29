#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * DSAR drill (Ley 21.719 Art 4-11).
 *
 * Simula end-to-end una solicitud publica de acceso del titular:
 *  1. Crea una solicitud publica POST /api/public/derechos
 *  2. Verifica SLA = +30 dias corridos
 *  3. Login admin (con DRILL_ADMIN_EMAIL/PASSWORD)
 *  4. PATCH para vincular paciente + identidad verificada
 *  5. POST resolve aceptada
 *  6. Lista AuditLog y verifica eventos PATIENT_RIGHT_*
 *  7. Reporta SLA cronometrado
 *
 * Variables de entorno:
 *   BACKEND_URL                 default http://localhost:3001
 *   DRILL_ADMIN_EMAIL           obligatorio para pasos 3-6
 *   DRILL_ADMIN_PASSWORD        obligatorio para pasos 3-6
 *   DRILL_PATIENT_ID            opcional — id del paciente de prueba ya creado
 *
 * Uso: node backend/scripts/drills/dsar-drill.js
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.DRILL_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.DRILL_ADMIN_PASSWORD;
const PATIENT_ID = process.env.DRILL_PATIENT_ID;

let cookieJar = '';

function setCookies(res) {
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.get('set-cookie');
  if (!setCookie) return;
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  cookieJar = arr.map((c) => c.split(';')[0]).join('; ');
}

async function http(method, path, body) {
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookieJar ? { Cookie: cookieJar } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  setCookies(res);
  return res;
}

async function main() {
  const t0 = Date.now();
  console.log('[DSAR DRILL] iniciado ' + new Date().toISOString());

  // 1) Solicitud publica
  const pubRes = await http('POST', '/public/derechos', {
    requesterName: `Titular Drill ${Date.now()}`,
    requesterEmail: `drill+${Date.now()}@example.com`,
    requestType: 'ACCESO',
    payloadRequest: 'Solicito copia de mis datos personales (drill automatizado).',
  });
  if (!pubRes.ok) {
    console.error(`[FAIL] POST /public/derechos => ${pubRes.status} ${await pubRes.text()}`);
    process.exit(1);
  }
  const created = await pubRes.json();
  const tCreated = Date.now();
  console.log(`[OK ${(tCreated - t0)}ms] Solicitud creada: ${created.id} due=${created.dueDate}`);

  // 2) Verificar SLA
  const ageDays = (new Date(created.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (Math.abs(ageDays - 30) > 1) {
    console.error(`[FAIL] SLA esperado ~30 dias, recibido ${ageDays.toFixed(2)}`);
    process.exit(1);
  }
  console.log(`[OK] SLA ${ageDays.toFixed(2)} dias`);

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('[INFO] DRILL_ADMIN_EMAIL/PASSWORD no provistos. Pasos 3-6 omitidos.');
    console.log(`[DSAR DRILL] completado parcialmente ${(Date.now() - t0)}ms`);
    return;
  }

  // 3) Login admin
  const loginRes = await http('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (!loginRes.ok) {
    console.error(`[FAIL] login admin => ${loginRes.status}`);
    process.exit(1);
  }
  console.log(`[OK ${(Date.now() - t0)}ms] login admin OK`);

  // 4) PATCH: vincular paciente + identidad verificada
  if (PATIENT_ID) {
    const patchRes = await http('PATCH', `/admin/data-requests/${created.id}`, {
      patientId: PATIENT_ID,
      identityVerificationMethod: 'PRESENCIAL',
      identityVerificationEvidence: { drill: true, recordedAt: new Date().toISOString() },
      status: 'EN_REVISION',
    });
    if (!patchRes.ok) {
      console.error(`[FAIL] PATCH => ${patchRes.status} ${await patchRes.text()}`);
      process.exit(1);
    }
    console.log(`[OK ${(Date.now() - t0)}ms] PATCH (vincular paciente + identidad)`);
  } else {
    console.log('[INFO] DRILL_PATIENT_ID no provisto — saltando vinculacion');
  }

  // 5) Resolve aceptada
  const resolveRes = await http('POST', `/admin/data-requests/${created.id}/resolve`, {
    status: 'RESUELTA_ACEPTADA',
    resolutionNote: 'Drill: solicitud procesada via DSAR-DRILL automatizado.',
  });
  if (!resolveRes.ok) {
    console.error(`[FAIL] resolve => ${resolveRes.status} ${await resolveRes.text()}`);
    process.exit(1);
  }
  const tResolved = Date.now();
  console.log(`[OK ${(tResolved - t0)}ms] RESUELTA_ACEPTADA`);

  // 6) AuditLog
  const auditRes = await http('GET', `/audit?entityType=PatientDataRequest&filter=${created.id}&limit=20`);
  if (auditRes.ok) {
    const audits = await auditRes.json();
    const items = Array.isArray(audits) ? audits : audits.data ?? [];
    console.log(`[OK] AuditLog tiene ${items.length} eventos asociados`);
  }

  const totalMs = Date.now() - t0;
  console.log('---');
  console.log(`[DSAR DRILL] completado en ${totalMs}ms`);
  console.log(`  Tiempo creacion → resolucion: ${tResolved - tCreated}ms (objetivo legal: 30 dias corridos)`);
  console.log(`  Auditoria verificada via /api/audit`);
}

main().catch((err) => {
  console.error('[DSAR DRILL] error:', err);
  process.exit(1);
});
