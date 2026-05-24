# Acciones que necesito de ti para cerrar cumplimiento Ley 21.719

**Fecha:** 2026-05-24  
**Alcance:** Anamneo, despliegue single-clinic en Chile  
**Referencia oficial:** Ley 21.719 / Ley 19.628 modificada, vigencia diferida al 2026-12-01 según BCN/Ley Chile.  
**Nota:** esto es una guía operativa para cerrar evidencias y decisiones; no reemplaza asesoría legal.

## Estado corto

La base técnica del repo está avanzada: derechos del titular, consentimiento separado de datos, bloqueo temporal, brechas, cifrado app-level de identificatorios principales, adjuntos, snapshots y entregas DSAR ya están implementados o documentados. Lo que falta para poder afirmar cumplimiento es principalmente:

- validación legal externa,
- firmas formales,
- configuración productiva,
- simulacros/drills con evidencia,
- contratos con subencargados,
- publicación efectiva de política v1.0,
- una ventana controlada para drops de columnas plaintext transitorias.

## Bloqueadores antes de tratar datos reales

| # | Necesito de ti | Por qué importa | Cómo hacerlo | Evidencia esperada |
|---|---|---|---|---|
| 1 | Contratar o asignar asesor legal chileno especialista en datos/salud | La política, DPIA, RAT, DPAs y retención sanitaria necesitan validación jurídica real | Entregarle `docs/preguntas-abogado-ley21719.md`, `docs/respuestas-borrador-ley21719.md`, `docs/dpia-2026.md`, `docs/data-processing-register.md` y este archivo | Informe o correos de validación; secciones marcadas `[VALIDADO_ABOGADO YYYY-MM-DD]` |
| 2 | Definir quién es el responsable del tratamiento | La ley exige identificar responsable, representante legal, domicilio y contacto | Completar datos de la clínica/entidad usuaria: razón social, RUT, representante, domicilio, email formal | Política v1.0 y RAT con datos completos |
| 3 | Firmar acta de DPO | El DPO debe quedar designado formalmente por la máxima autoridad | Completar y firmar `docs/dpo-designation-act.md` | PDF firmado guardado en drive seguro de cumplimiento |
| 4 | Aprobar y publicar política de privacidad v1.0 | No basta el borrador; debe estar vigente y accesible | Reemplazar el contenido draft del seed/admin legal con el texto validado, publicar `PRIVACY` v1.0 y verificar `/politica-de-privacidad` | Captura/URL pública + registro de publicación |
| 5 | Firmar DPIA | Anamneo trata datos sensibles de salud; la DPIA es obligatoria | Revisar `docs/dpia-2026.md`, completar `[PENDIENTE_ABOGADO]`, firmar por DPO/responsable | DPIA firmada y versionada |
| 6 | Firmar RAT | Acredita responsabilidad proactiva y transparencia por finalidad | Revisar `docs/data-processing-register.md`, completar responsable/proveedores/países/retención, firmar | RAT firmado y versionado |
| 7 | Firmar DPAs con clínica y subencargados | Cloudflare, Sentry, SMTP, hosting y soporte pueden ser subencargados o transferencias internacionales | Revisar contratos/DPA estándar, completar anexo de subencargados, guardar copias firmadas | Carpeta con DPAs vigentes |
| 8 | Confirmar matriz de retención sanitaria | La app usa default de 15 años; debe validarse por tipo de ficha/documento | Pedir al abogado confirmar plazo por ficha clínica, adjuntos, consentimientos, logs, backups y snapshots | Tabla final de retención firmada |
| 9 | Activar `REGULATORY_CONSENT_ENFORCEMENT=hard` en producción | En `soft` el sistema advierte pero no bloquea pacientes sin consentimiento vigente | Activarlo solo después de publicar política v1.0 y cargar/backfillear consentimientos necesarios | `.env` productivo + prueba de bloqueo real |
| 10 | Ejecutar restore drill en infraestructura real | El cumplimiento no se demuestra solo con backups; hay que probar restauración | Forzar restore drill según docs de operación y conservar log | Resultado del drill, fecha, responsable y tiempo de recuperación |

## Configuración productiva que debes completar

Completar `.env` productivo con valores reales, no placeholders:

```bash
NODE_ENV=production
ANAMNEO_DEPLOYMENT_SCOPE=single-clinic
DATABASE_URL=postgresql://...
MIGRATION_DATABASE_URL=postgresql://...
JWT_SECRET=<32+ chars>
JWT_REFRESH_SECRET=<32+ chars distinto>
BOOTSTRAP_TOKEN=<32+ chars>
SETTINGS_ENCRYPTION_KEY=<clave segura>
ENCRYPTION_KEY=<64 hex chars>
ENCRYPTION_AT_REST_CONFIRMED=true
REGULATORY_CONSENT_ENFORCEMENT=hard
NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true
CORS_ORIGIN=https://<dominio>
APP_PUBLIC_URL=https://<dominio>
NEXT_PUBLIC_API_URL=/api
API_PROXY_TARGET=http://backend:5678/api
```

Cómo generar `ENCRYPTION_KEY`:

```bash
openssl rand -hex 32
```

Qué guardar fuera del servidor:

- `ENCRYPTION_KEY`
- `SETTINGS_ENCRYPTION_KEY`
- secretos JWT
- credenciales PostgreSQL
- backup cifrado de `.env`

Sin `ENCRYPTION_KEY` no se pueden recuperar identificatorios y adjuntos cifrados si se pierde la clave.

## Proveedores y transferencias internacionales

Necesito que confirmes proveedor real y país para:

| Servicio | Dato a confirmar | Acción |
|---|---|---|
| Cloudflare | plan/cuenta, DPA, países de tratamiento | Descargar DPA y anexar al RAT |
| Sentry | organización, región, DPA, retención | Confirmar `sendDefaultPii=false`, DPA y país |
| SMTP | proveedor, país, DPA, TLS | Configurar SMTP real y contrato |
| Hosting/VPS | país físico, cifrado de disco, backups | Confirmar LUKS/dm-crypt o cifrado equivalente |
| Soporte externo | personas con acceso, contratos, confidencialidad | Firmar cláusulas de confidencialidad |

Resultado esperado: completar `docs/data-processing-register.md` §3 con países, garantías y DPA firmado sí/no.

## Drills que debes ejecutar y documentar

Ejecutar en staging o producción controlada, no solo en dev.

### 1. Solicitud de derechos del titular

Objetivo: probar acceso/portabilidad end-to-end.

Pasos:

1. Abrir `/derechos`.
2. Crear una solicitud de acceso con datos de prueba.
3. Entrar como admin a `/admin/solicitudes`.
4. Verificar identidad y vincular paciente.
5. Generar enlace temporal de descarga.
6. Descargar usando RUT.
7. Resolver solicitud.
8. Guardar timestamps y evidencia.

Evidencia:

- captura de solicitud recibida,
- email de acuse,
- log de enlace generado,
- descarga auditada,
- resolución dentro del plazo.

### 2. Brecha simulada

Objetivo: probar Art 14 sexies.

Pasos:

1. Crear incidente `DataBreachIncident` con severidad `ALTO` en staging.
2. Documentar evaluación de riesgo razonable.
3. Ejecutar flujo de notificación a titulares con paciente de prueba.
4. Marcar reporte a Agencia como simulado.
5. Cerrar incidente con post-mortem.

Evidencia:

- incidente creado,
- email de titular,
- evaluación firmada por DPO,
- línea de tiempo,
- post-mortem.

### 3. Restore drill

Objetivo: demostrar recuperación desde backup.

Pasos generales:

1. Tomar backup reciente.
2. Restaurar en base temporal.
3. Verificar migraciones.
4. Ejecutar smoke clínico.
5. Ejecutar verificación de auditoría.

Comandos útiles, ajustar a entorno:

```bash
npm run db:ops
npm --prefix backend run audit:integrity:verify
```

Evidencia:

- fecha/hora de backup,
- fecha/hora de restore,
- duración,
- resultado,
- responsable.

## Migraciones y drops de plaintext

El schema principal ya está orientado a cifrado app-level. Quedan migraciones pendientes para eliminar columnas plaintext transitorias:

- `backend/prisma/migrations-pending/20260524010000_ley21719_phase_d_drop_legal_representative_plaintext`
- `backend/prisma/migrations-pending/20260524020000_ley21719_phase_e_drop_consent_signer_plaintext`
- `backend/prisma/migrations-pending/20260524030000_ley21719_phase_f_drop_data_request_requester_plaintext`

No las apliques sin ventana controlada.

Procedimiento:

1. Confirmar que `ENCRYPTION_KEY` está respaldada.
2. Ejecutar backfill correspondiente:

```bash
node backend/scripts/backfill-legal-representative-encryption.js --dry-run
node backend/scripts/backfill-legal-representative-encryption.js
node backend/scripts/backfill-consent-signer-encryption.js --dry-run
node backend/scripts/backfill-consent-signer-encryption.js
node backend/scripts/backfill-data-request-requester-encryption.js --dry-run
node backend/scripts/backfill-data-request-requester-encryption.js
```

3. Verificar conteos en base.
4. Tomar backup completo.
5. Mover una migración desde `migrations-pending` a `migrations`.
6. Aplicar:

```bash
npm --prefix backend run prisma:migrate:prod
npm --prefix backend run prisma:generate
```

Alternativa con el CLI local:

```bash
node backend/node_modules/prisma/build/index.js migrate deploy --schema backend/prisma/schema.prisma
node backend/node_modules/prisma/build/index.js generate --schema backend/prisma/schema.prisma
```

7. Ejecutar typecheck, tests y smoke.

## Validaciones antes de Go/No-Go

Ejecutar desde raíz:

```bash
npm --prefix backend run typecheck
npm --prefix backend run test
npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts
npm --prefix frontend run typecheck
npm --prefix frontend run test
npm --prefix frontend run test:e2e
npm --prefix backend run audit:integrity:verify
```

Si Playwright falla porque no hay backend en `:5678`, levantar stack:

```bash
npm run dev
```

## Paquete de fiscalización

Crear un drive/carpeta segura con:

- Política de privacidad v1.0 publicada.
- Términos vigentes.
- DPO firmado.
- DPIA firmada.
- RAT firmado.
- DPAs firmados.
- Matriz de retención.
- Programa de prevención de infracciones.
- Modelo voluntario, si se adopta.
- Plan de capacitación y asistencias.
- Bitácora de decisiones.
- Registro de solicitudes del titular.
- Registro de incidentes y drills.
- Evidencia de backups/restore.
- Evidencia de `audit:integrity:verify`.
- Inventario de usuarios/admins y revisión de permisos.

## Decisión final

No marcar producción con datos reales como lista hasta que estén cerrados:

- política v1.0 publicada,
- DPO/DPIA/RAT firmados,
- DPAs reales firmados o aprobados,
- `REGULATORY_CONSENT_ENFORCEMENT=hard`,
- restore drill real,
- drill DSAR,
- drill de brecha,
- `audit:integrity:verify` limpio,
- respaldo externo de claves de cifrado.
