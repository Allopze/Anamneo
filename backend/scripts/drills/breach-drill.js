#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Breach drill (Ley 21.719 Art 14 sexies).
 *
 * Simula end-to-end un incidente de seguridad cronometrando los hitos:
 *  1. Login admin
 *  2. POST /api/admin/data-breaches (CREATE incidente severity=ALTO)
 *  3. POST /:id/assess (evaluacion de riesgo razonable)
 *  4. POST /:id/notify-agency (registra timestamp)
 *  5. POST /:id/notify-subjects (envia notificacion a titulares afectados)
 *  6. POST /:id/close (post-mortem)
 *  7. Verifica auditoria
 *
 * Objetivo operativo: completar el flujo en <72h reales (en drill se
 * cronometra el wallclock de los pasos automatizados; el objetivo se
 * mide en horas en operacion real).
 *
 * Variables de entorno:
 *   BACKEND_URL                  default http://localhost:3001
 *   DRILL_ADMIN_EMAIL            obligatorio
 *   DRILL_ADMIN_PASSWORD         obligatorio
 *   DRILL_AFFECTED_PATIENT_IDS   opcional — JSON array de patientIds reales
 *
 * Uso: node backend/scripts/drills/breach-drill.js
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.DRILL_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.DRILL_ADMIN_PASSWORD;
const AFFECTED_PATIENT_IDS = process.env.DRILL_AFFECTED_PATIENT_IDS
  ? JSON.parse(process.env.DRILL_AFFECTED_PATIENT_IDS)
  : [];

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
  console.log('[BREACH DRILL] iniciado ' + new Date().toISOString());

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('[FAIL] DRILL_ADMIN_EMAIL y DRILL_ADMIN_PASSWORD son obligatorios');
    process.exit(1);
  }

  // 1) Login
  const loginRes = await http('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (!loginRes.ok) {
    console.error(`[FAIL] login => ${loginRes.status}`);
    process.exit(1);
  }
  console.log(`[OK ${Date.now() - t0}ms] login admin`);

  // 2) Create incident
  const createRes = await http('POST', '/admin/data-breaches', {
    detectedAt: new Date().toISOString(),
    severity: 'ALTO',
    scope: 'Drill automatizado: acceso anomalo detectado en el sistema durante simulacro de brecha.',
    affectedPatientIds: AFFECTED_PATIENT_IDS,
    rootCause: 'Drill: causa simulada, no representa incidente real.',
    containmentActions: 'Drill: medidas de contencion simuladas (rotacion de credenciales, revocacion de sesiones).',
  });
  if (!createRes.ok) {
    console.error(`[FAIL] create => ${createRes.status} ${await createRes.text()}`);
    process.exit(1);
  }
  const incident = await createRes.json();
  const tCreated = Date.now();
  console.log(`[OK ${tCreated - t0}ms] incidente creado: ${incident.id} severity=${incident.severity}`);

  // 3) Assess riesgo razonable
  const assessRes = await http('POST', `/admin/data-breaches/${incident.id}/assess`, {
    riskAssessment:
      'Drill: presuncion de riesgo razonable por ser datos sensibles de salud identificables. ' +
      'Categorias afectadas: identificatorios + clinicos. No hay mitigantes que descarten el riesgo.',
    agencyDecision: 'REPORTAR',
  });
  if (!assessRes.ok) {
    console.error(`[FAIL] assess => ${assessRes.status} ${await assessRes.text()}`);
    process.exit(1);
  }
  console.log(`[OK ${Date.now() - t0}ms] assess (riesgo razonable documentado)`);

  // 4) Notify agency
  const notifyAgencyRes = await http('POST', `/admin/data-breaches/${incident.id}/notify-agency`, {});
  if (!notifyAgencyRes.ok) {
    console.error(`[FAIL] notify-agency => ${notifyAgencyRes.status} ${await notifyAgencyRes.text()}`);
    process.exit(1);
  }
  const tAgency = Date.now();
  console.log(`[OK ${tAgency - t0}ms] notify-agency`);

  // 5) Notify subjects (solo si hay afectados)
  if (AFFECTED_PATIENT_IDS.length > 0) {
    const notifySubjectsRes = await http('POST', `/admin/data-breaches/${incident.id}/notify-subjects`, {
      measuresTaken:
        'Drill: medidas adoptadas (rotacion de credenciales, refuerzo de monitoreo, ' +
        'revision de logs, contacto con DPO y asesor legal).',
      dpoName: 'Alejandro Lopez Zelaya',
      dpoEmail: 'allopze@gmail.com',
      dataCategoriesAffected: 'Identificatorios + datos clinicos sensibles',
      possibleConsequences: 'Riesgo de acceso indebido a su informacion de salud.',
      recommendedActions: 'Si nota uso indebido de su informacion, contactenos de inmediato.',
      consultationChannels: 'Email al DPO: allopze@gmail.com',
      followUpInfo: 'Le mantendremos informado(a) si se identifican impactos adicionales.',
    });
    if (!notifySubjectsRes.ok) {
      console.error(`[FAIL] notify-subjects => ${notifySubjectsRes.status} ${await notifySubjectsRes.text()}`);
      process.exit(1);
    }
    const result = await notifySubjectsRes.json();
    console.log(`[OK ${Date.now() - t0}ms] notify-subjects sent=${result?.deliveryStats?.sent} skipped=${result?.deliveryStats?.skipped}`);
  } else {
    console.log('[INFO] DRILL_AFFECTED_PATIENT_IDS vacio — saltando notify-subjects');
  }

  // 6) Close
  const closeRes = await http('POST', `/admin/data-breaches/${incident.id}/close`, {
    postMortem:
      'Drill: post-mortem simulado. Linea de tiempo capturada via timestamps del propio drill. ' +
      'Acciones correctivas: revision de hardening y rotacion programada.',
  });
  if (!closeRes.ok) {
    console.error(`[FAIL] close => ${closeRes.status}`);
    process.exit(1);
  }
  const tClosed = Date.now();
  console.log(`[OK ${tClosed - t0}ms] CERRADO`);

  // 7) Audit chain check
  const verifyRes = await http('GET', '/audit/integrity/snapshot');
  if (verifyRes.ok) {
    const snap = await verifyRes.json();
    console.log(`[OK] integridad de cadena: valid=${snap?.valid} checked=${snap?.checked}/${snap?.total}`);
  }

  const totalMs = Date.now() - t0;
  console.log('---');
  console.log(`[BREACH DRILL] completado en ${totalMs}ms`);
  console.log(`  detect → notify-agency: ${tAgency - tCreated}ms (objetivo operativo: <72h)`);
  console.log(`  detect → close: ${tClosed - tCreated}ms`);
}

main().catch((err) => {
  console.error('[BREACH DRILL] error:', err);
  process.exit(1);
});
