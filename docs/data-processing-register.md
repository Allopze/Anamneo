# Registro de Actividades de Tratamiento (RAT) — Anamneo

**Norma de referencia:** Ley 21.719 Art 3 lit e (principio de responsabilidad) + Art 14 ter + Art 15 bis
**Versión:** 0.1 — Borrador estructural (2026-05-23)
**Estado:** Borrador interno, pendiente de validación legal externa
**DPO responsable:** Alejandro López Zelaya `<allopze@gmail.com>` (interino)

> **Aviso:** este documento es el RAT exigido por la Ley 21.719. Estructura validada contra los requisitos del Art 14 ter y la práctica internacional (GDPR Art 30 como referencia). El contenido sustantivo de cada fila se valida con el asesor legal — ver [`preguntas-abogado-ley21719.md`](preguntas-abogado-ley21719.md) §2.5.

---

## 1. Responsable, encargado y DPO

| Rol | Identidad | Contacto |
|---|---|---|
| Responsable del tratamiento | [PENDIENTE — clínica usuaria que decide finalidades] | [PENDIENTE — domicilio, email, representante legal] |
| Encargado del tratamiento | [PENDIENTE — operador técnico de la instancia Anamneo] | [PENDIENTE] |
| DPO | Alejandro López Zelaya (interino) | allopze@gmail.com |

## 2. Actividades de tratamiento (estructura mínima Art 14 ter)

| # | Finalidad | Categorías de datos | Categorías de titulares | Destinatarios | Transferencias intl | Plazo conservación | Base legal | Medidas seguridad |
|---|---|---|---|---|---|---|---|---|
| A1 | Atención clínica (registro de ficha) | Identificatorios, contacto, salud, NNA representante | Pacientes (incluye NNA) | Sólo personal sanitario autorizado de la clínica | No directas (PHI no se envía a subencargados; sólo metadatos vía Cloudflare/Sentry con scrubbing) | 15 años desde última atención (referencia mínima Ley 20.584) | Art 16 lit e Ley 21.719 + Ley 20.584 + Código Sanitario | §5.1 del DPIA + cifrado app-level (Ola 3) |
| A2 | Generación de documentos clínicos (recetas, órdenes, derivaciones) | Identificatorios, salud | Pacientes | Pacientes (entrega presencial o por email) | No | Mismo que A1 | Art 16 lit e | Mismo que A1 |
| A3 | Auditoría y trazabilidad | Identificadores, usuarios, requestId, IP | Pacientes y personal | Sólo admin y auditoría interna | Logs técnicos vía Sentry (scrubbed) | Indefinido / mínimo 4 años (prescripción Art 40) | Art 13 lit b (obligación legal) + Art 3 lit e | Cadena hash SHA-256 verificable |
| A4 | Comunicaciones transaccionales (invitaciones a personal) | Email, nombre | Personal sanitario | El propio personal | SMTP provider [PENDIENTE confirmar país] | TTL invitación + 30 días | Art 13 lit d (interés legítimo) | TLS + token único cifrado |
| A5 | Monitoreo técnico (Sentry, logs HTTP) | Telemetría con PHI scrubbed | Indirectamente todos | Sentry (EE.UU.) | Sí — EE.UU. | Política del provider (revisable) | Art 13 lit d + minimización | PHI scrubbing en `instrument.ts` |
| A6 | Analítica clínica interna (gestión asistencial) | Datos clínicos agregados | Pacientes (cohortes) | Sólo personal autorizado de la clínica | No | Mismo que A1 | Gestión sanitaria (Art 16 lit e) | Anonimización pendiente para cohortes <5 |
| A6b | Analítica con datos identificables (NO en uso hoy) | Datos clínicos identificables | Pacientes | — | — | — | Requiere base legal separada: Art 16 quinquies, consentimiento o autorización específica | Documentar como tratamiento nuevo si se activa |
| A7 | Backups | Todos los datos de la base | Pacientes y personal | Sólo administrador técnico | Posible (depende del host) | 14 días rotativos por defecto | Art 14 quinquies lit c (resiliencia) | Cifrado en reposo |
| A8 | Gestión de derechos del titular (Ola 2) | Identidad solicitante + evidencia | Titular o representante | Solicitante (vía email) | No | Plazo legal de prescripción (Art 40) | Art 4-11 Ley 21.719 | Auditoría especial `PATIENT_RIGHT_*` |
| A9 | Gestión de consentimiento del titular (Ola 1) | Identidad firmante, IP, UA, hash de evidencia | Titular o representante | Sólo encargado y DPO | No | Mientras dure el tratamiento + 4 años | Art 12 Ley 21.719 | Hash SHA-256 + cadena auditoría |
| A10 | Gestión de brechas (Ola 3) | Datos sensibles afectados (alcance) | Titulares afectados | Agencia + titulares + DPO | No | Indefinido (evidencia regulatoria) | Art 14 sexies | Acceso restringido + auditoría |

## 2-ext. Columnas adicionales (estructura recomendada para fiscalización)

Esta tabla extiende la matriz §2 con columnas operativas. Por brevedad
se referencia por ID de actividad (A1, A2, …) y se completa con valores
o `[PENDIENTE]` cuando aún se requiere decisión.

| ID | Responsable | Encargado / subencargado | Sistema / módulo | Fuente de datos | País destino | Mecanismo transferencia | Requiere DPIA | Nivel de riesgo | Roles con acceso | Método eliminación / anonimización | Responsable interno | Última revisión |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | Clínica usuaria | Anamneo (encargado) | `patients`, `encounters`, `attachments` | Titular / representante (presencial) | Chile | N/A | Sí | Alto | MEDICO, ASISTENTE (con scope), ADMIN | Soft-delete + purge `PatientsRegulatoryPurgeService` con snapshot cifrado | DPO interino | 2026-05-23 |
| A2 | Clínica usuaria | Anamneo (encargado) | `patients-pdf`, `encounters-workflow-complete-sign` | Datos de A1 + plantillas | Chile | N/A | Sí (cuando A1) | Alto | MEDICO | Documento se entrega al titular, copia queda en `encounters.signatures` | DPO interino | 2026-05-23 |
| A3 | Clínica + Anamneo | Anamneo (encargado) | `AuditService` | Eventos del sistema | Chile (DB local) + EE.UU. (Sentry, scrubbed) | SCC para Sentry [PENDIENTE firma DPA] | No | Medio | ADMIN | Retención indefinida; rotación de Sentry según provider | DPO interino | 2026-05-23 |
| A4 | Clínica usuaria | Anamneo (encargado) + SMTP provider (subencargado) | `MailService` | Datos del personal | [PENDIENTE confirmar país SMTP] | [PENDIENTE — SCC o adecuado] | No | Bajo | ADMIN | Token único; revoca al uso o expiración | DPO interino | 2026-05-23 |
| A5 | Clínica + Anamneo | Sentry (subencargado), Cloudflare (subencargado) | `instrument.ts`, Cloudflare Tunnel | Sistema | EE.UU. | SCC modelo aprobado por RAEX202503748 (12-2025) [PENDIENTE firma] | No | Bajo (con scrubbing) | ADMIN | Política del provider | DPO interino | 2026-05-23 |
| A6 | Clínica usuaria | Anamneo (encargado) | `clinical-analytics` | Datos de A1 | Chile | N/A | Recomendado si se agrega cohortes pequeñas | Medio | MEDICO | Anonimización antes de exportar | DPO interino | 2026-05-23 |
| A6b | Clínica usuaria | Anamneo (encargado, si se activara) | NO en uso | — | — | — | **Sí, obligatoria antes de activar** | Alto | — | — | DPO interino | 2026-05-23 |
| A7 | Clínica usuaria | Anamneo + hosting provider | `pg-backup.js`, `pg-restore-drill.js` | Volumen Postgres | [PENDIENTE confirmar país hosting] | [PENDIENTE] | No | Medio | Administrador técnico | TTL configurado; restore drills | DPO interino | 2026-05-23 |
| A8 | Clínica usuaria | Anamneo (encargado) | `patient-data-rights` | Solicitudes públicas / admin | Chile | N/A | No | Medio | ADMIN + titular (suyas) | Conservar para prescripción Art 40 | DPO interino | 2026-05-23 |
| A9 | Clínica usuaria | Anamneo (encargado) | `patient-consents` | Titular o representante (presencial / web) | Chile | N/A | No | Medio | ADMIN | Snapshot inmutable + revocaciones | DPO interino | 2026-05-23 |
| A10 | Clínica usuaria | Anamneo (encargado) | `data-breach` | Detección interna / externa | Chile | N/A | No | Crítico | DPO + ADMIN | Conservar indefinidamente | DPO interino | 2026-05-23 |

## 3. Matriz de bases legales por finalidad

Sigue la recomendación del asesor: cada finalidad anclada a una base
legal concreta, distinguiendo lo asistencial de lo opcional. No mezclar
finalidades bajo una única base.

| Finalidad | Base legal probable | Observación |
|---|---|---|
| Registro y mantención de ficha clínica | Ley 20.584 + normativa sanitaria | Tratamiento necesario para prestación sanitaria y conservación obligatoria. |
| Atención clínica y continuidad del cuidado | Ley 20.584 + Código Sanitario + Art 16 lit e Ley 21.719 | No debería depender exclusivamente del consentimiento de privacidad. |
| Gestión operativa del sistema asistencial | Excepción sanitaria / gestión de servicios de salud | Debe limitarse a lo necesario para la operación. |
| Soporte técnico de la plataforma | Contrato encargado-responsable + instrucciones de la clínica (Art 15 bis) | Requiere DPA y controles de acceso. |
| Auditoría, seguridad y logs | Art 13 lit b + Art 14 quinquies + Art 3 lit e | Retención y acceso estrictamente limitados. |
| Comunicaciones clínicas transaccionales | Prestación del servicio / atención sanitaria | Separar de marketing. |
| Marketing | Consentimiento separado | NO mezclar con atención clínica. NO activo hoy. |
| Investigación | Consentimiento, anonimización o Art 16 quinquies | Evaluar comité ético cuando aplique. |
| Analítica comercial o de producto con datos identificables | Requiere base separada | Preferir anonimización o agregación robusta. NO activa hoy. |
| Entrenamiento de modelos | Alta sensibilidad | Requiere DPIA específica, base legal separada y controles reforzados. NO activo hoy. |

## 3. Subencargados

| Subencargado | Servicio | País | Categoría de datos | Garantía actual | DPA firmado |
|---|---|---|---|---|---|
| Cloudflare | CDN + Tunnel | EE.UU. / red global | Telemetría HTTP, metadatos de requests | DPA estándar Cloudflare [PENDIENTE confirmar adecuación a Ley 21.719] | No |
| Sentry | Telemetría de errores | EE.UU. | Errores con PHI scrubeado | DPA estándar Sentry [PENDIENTE] | No |
| Proveedor SMTP | Correos transaccionales | [PENDIENTE] | Email + token de invitación | [PENDIENTE] | No |
| Hosting / VPS | Cómputo y almacenamiento | [PENDIENTE] | Toda la base | Cifrado de disco LUKS + acceso restringido | [PENDIENTE] |

[PENDIENTE_ABOGADO] Confirmar para cada subencargado: país, garantías Art 27-28 aplicables y necesidad de DPA específico bajo Ley 21.719.

## 4. Categorías de datos tratados

| Categoría | Sensibilidad | Origen | Tratado en |
|---|---|---|---|
| Identificatorios (RUT, nombre, fecha nacimiento) | Alta | Titular o representante | A1, A2, A8, A9 |
| Contacto (teléfono, email, domicilio) | Alta | Titular | A1, A2 |
| Salud (PHI) | **Sensible (Art 2 lit g)** | Titular y equipo tratante | A1, A2, A6, A10 |
| Representante legal de NNA | Alta | Representante | A1, A9 |
| Datos del personal sanitario | Media | Personal mismo | A1, A3, A4 |
| Telemetría | Baja | Sistema | A3, A5 |

## 5. Revisión y actualización

Este RAT se revisa:
- Al cierre de cada ola del roadmap.
- Al incorporar una nueva finalidad o un nuevo subencargado.
- Como mínimo, una vez al año.

## 6. Referencias

- [DPIA Anamneo](dpia-2026.md)
- [Auditoría completa Ley 21.719](audits/ley-21719-chile-audit-2026-05-23.md)
- [ADR-002 Cumplimiento Ley 21.719](architecture-decisions/002-ley-21719-compliance.md)
- [Política de Privacidad v1.0 (borrador, seedeada como DRAFT)](../backend/prisma/seed.ts)
- [Preguntas al asesor legal](preguntas-abogado-ley21719.md)
