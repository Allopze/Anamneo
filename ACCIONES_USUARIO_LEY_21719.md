# Acciones de privacidad para Anamneo

**Fecha:** 2026-05-24  
**Alcance actual:** app personal de apoyo al estudio de medicina; no comercial, no clínica, no SaaS.  
**Alcance futuro posible:** despliegue single-clinic en Chile con pacientes reales.  
**Referencia oficial:** Ley 21.719 / Ley 19.628 modificada, vigencia diferida al 2026-12-01 según BCN/Ley Chile.  
**Nota:** esto es una guía operativa de reducción de riesgo; no reemplaza asesoría legal.

## Estado corto
El enfoque anterior asumía que Anamneo iba camino a operar con datos reales
de pacientes en contexto clínico. Eso llevaba a una ruta pesada: abogado,
DPO, DPIA, RAT, DPAs, drills, políticas públicas y evidencia formal.

Para el uso real de hoy, el objetivo correcto es otro:

- **no ingresar datos reales identificables de pacientes**;
- usar casos ficticios, simulados o anonimizados para estudiar;
- mantener la app cerrada, privada y con pocos usuarios;
- conservar los controles técnicos útiles que ya existen;
- dejar la ruta legal completa como condición futura si el proyecto cambia
  de uso personal a uso clínico o comercial.

## Ruta recomendada para uso personal/estudio
Estas son las acciones razonables hoy, sin convertir el proyecto en una carga
jurídica imposible:

| # | Acción | Por qué importa | Evidencia suficiente |
|---|---|---|---|
| 1 | No usar nombres, RUT, emails, teléfonos, direcciones, fotos ni documentos de pacientes reales | Si no hay datos personales identificables, baja drásticamente el riesgo legal y ético | Checklist personal aceptado por quienes usen la app |
| 2 | Crear casos ficticios o anonimizados antes de ingresarlos | Para estudiar anamnesis y razonamiento clínico no hace falta identificar a nadie | Convención escrita: "todo caso debe ser ficticio o anonimizado" |
| 3 | Mantener acceso solo para ti y tu novia | Reduce exposición, superficie de ataque y obligaciones prácticas | Inventario corto de usuarios |
| 4 | No publicar la app como servicio abierto ni promocionarla como herramienta clínica | Evita que se transforme en producto sanitario o tratamiento organizado de datos | README/nota interna de alcance |
| 5 | Desactivar integraciones externas innecesarias para estudio | Evita enviar datos a proveedores si no aportan valor real | `.env` sin Sentry/SMTP públicos cuando no sean necesarios |
| 6 | Usar contraseñas fuertes, 2FA si está disponible y cifrado local/disco | Controles simples con buen retorno | Configuración revisada |
| 7 | Borrar regularmente datos de prueba que ya no sirvan | Minimización práctica | Limpieza mensual o al terminar cada ciclo de estudio |
| 8 | Si aparece un caso real, transformarlo antes de guardarlo | La regla operativa debe ser "no copiar fichas clínicas" | Datos reemplazados por valores sintéticos |

Regla de oro: si un tercero pudiera reconocer al paciente por el contenido,
no debe entrar a Anamneo en el modo personal/estudio.

## Línea roja: cuándo vuelve la ruta legal completa
La ruta pesada vuelve a ser necesaria si ocurre cualquiera de estas cosas:

- se guardan datos reales identificables de pacientes;
- más personas usan la app como parte de una práctica clínica;
- una clínica, universidad, consulta o prestador la adopta formalmente;
- se publica en internet como servicio para terceros;
- se cobran planes, soporte o acceso;
- se integran proveedores que procesan datos clínicos reales;
- se usa IA externa con datos clínicos reales;
- se quiere afirmar "cumple Ley 21.719" frente a terceros.

## Bloqueadores antes de tratar datos reales identificables
Lo siguiente **no es necesario para el uso personal con datos ficticios o
anonimizados**. Sí pasa a ser bloqueador antes de operar con datos reales de
pacientes o con una institución de salud.

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
| 9 | Activar `REGULATORY_CONSENT_ENFORCEMENT=hard` en producción clínica | En `soft` el sistema advierte pero no bloquea pacientes sin consentimiento vigente | Activarlo solo después de publicar política v1.0 y cargar/backfillear consentimientos necesarios | `.env` productivo + prueba de bloqueo real |
| 10 | Ejecutar restore drill en infraestructura real | El cumplimiento no se demuestra solo con backups; hay que probar restauración | Forzar restore drill según docs de operación y conservar log | Resultado del drill, fecha, responsable y tiempo de recuperación |

## Configuración si algún día hay producción clínica

Completar `.env` productivo con valores reales, no placeholders, solo si el
proyecto pasa a tratar pacientes reales:

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

## Proveedores y transferencias internacionales futuras

Confirmar proveedor real y país solo si hay despliegue clínico o datos reales:

| Servicio | Dato a confirmar | Acción |
|---|---|---|
| Cloudflare | plan/cuenta, DPA, países de tratamiento | Descargar DPA y anexar al RAT |
| Sentry | organización, región, DPA, retención | Confirmar `sendDefaultPii=false`, DPA y país |
| SMTP | proveedor, país, DPA, TLS | Configurar SMTP real y contrato |
| Hosting/VPS | país físico, cifrado de disco, backups | Confirmar LUKS/dm-crypt o cifrado equivalente |
| Soporte externo | personas con acceso, contratos, confidencialidad | Firmar cláusulas de confidencialidad |

Resultado esperado: completar `docs/data-processing-register.md` §3 con países, garantías y DPA firmado sí/no.

## Drills para despliegue clínico

Ejecutar en staging o producción controlada, no solo en dev, si Anamneo pasa
a un contexto clínico real.

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

## Validaciones antes de Go/No-Go clínico

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

## Paquete de fiscalización futuro

Crear un drive/carpeta segura solo si se busca operar con datos reales o
demostrar cumplimiento ante terceros:

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

Mantener Anamneo en modo personal/estudio mientras use casos ficticios o
anonimizados. No marcar producción con datos reales como lista hasta que estén
cerrados:

- política v1.0 publicada,
- DPO/DPIA/RAT firmados,
- DPAs reales firmados o aprobados,
- `REGULATORY_CONSENT_ENFORCEMENT=hard`,
- restore drill real,
- drill DSAR,
- drill de brecha,
- `audit:integrity:verify` limpio,
- respaldo externo de claves de cifrado.
