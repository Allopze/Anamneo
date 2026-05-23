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

## 2. Actividades de tratamiento

| # | Finalidad | Categorías de datos | Categorías de titulares | Destinatarios | Transferencias intl | Plazo conservación | Base legal | Medidas seguridad |
|---|---|---|---|---|---|---|---|---|
| A1 | Atención clínica (registro de ficha) | Identificatorios, contacto, salud, NNA representante | Pacientes (incluye NNA) | Sólo personal sanitario autorizado de la clínica | No directas (PHI no se envía a subencargados; sólo metadatos vía Cloudflare/Sentry con scrubbing) | 15 años post última atención [PENDIENTE_ABOGADO confirmar norma] | Art 16 lit e Ley 21.719 + ley sanitaria especial | §5.1 del DPIA + cifrado app-level (Ola 3) |
| A2 | Generación de documentos clínicos (recetas, órdenes, derivaciones) | Identificatorios, salud | Pacientes | Pacientes (entrega presencial o por email) | No | Mismo que A1 | Art 16 lit e | Mismo que A1 |
| A3 | Auditoría y trazabilidad | Identificadores, usuarios, requestId, IP | Pacientes y personal | Sólo admin y auditoría interna | Logs técnicos vía Sentry (scrubbed) | Indefinido / mínimo 4 años (prescripción Art 40) | Art 13 lit b (obligación legal) + Art 3 lit e | Cadena hash SHA-256 verificable |
| A4 | Comunicaciones transaccionales (invitaciones a personal) | Email, nombre | Personal sanitario | El propio personal | SMTP provider [PENDIENTE confirmar país] | TTL invitación + 30 días | Art 13 lit d (interés legítimo) | TLS + token único cifrado |
| A5 | Monitoreo técnico (Sentry, logs HTTP) | Telemetría con PHI scrubbed | Indirectamente todos | Sentry (EE.UU.) | Sí — EE.UU. | Política del provider (revisable) | Art 13 lit d + minimización | PHI scrubbing en `instrument.ts` |
| A6 | Analítica clínica agregada | Datos clínicos agregados | Pacientes (cohortes) | Sólo personal autorizado de la clínica | No | Mismo que A1 | Art 16 quinquies | Anonimización pendiente para cohortes <5 |
| A7 | Backups | Todos los datos de la base | Pacientes y personal | Sólo administrador técnico | Posible (depende del host) | 14 días rotativos por defecto | Art 14 quinquies lit c (resiliencia) | Cifrado en reposo |
| A8 | Gestión de derechos del titular (Ola 2) | Identidad solicitante + evidencia | Titular o representante | Solicitante (vía email) | No | Plazo legal de prescripción (Art 40) | Art 4-11 Ley 21.719 | Auditoría especial `PATIENT_RIGHT_*` |
| A9 | Gestión de consentimiento del titular (Ola 1) | Identidad firmante, IP, UA, hash de evidencia | Titular o representante | Sólo encargado y DPO | No | Mientras dure el tratamiento + 4 años | Art 12 Ley 21.719 | Hash SHA-256 + cadena auditoría |
| A10 | Gestión de brechas (Ola 3) | Datos sensibles afectados (alcance) | Titulares afectados | Agencia + titulares + DPO | No | Indefinido (evidencia regulatoria) | Art 14 sexies | Acceso restringido + auditoría |

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
- [Auditoría completa Ley 21.719](../AUDITORIA_LEY_21719_CHILE.md)
- [ADR-002 Cumplimiento Ley 21.719](architecture-decisions/002-ley-21719-compliance.md)
- [Política de Privacidad v1.0 (borrador, seedeada como DRAFT)](../backend/prisma/seed.ts)
- [Preguntas al asesor legal](preguntas-abogado-ley21719.md)
