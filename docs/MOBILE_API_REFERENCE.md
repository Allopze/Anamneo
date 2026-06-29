# Anamneo — Referencia de API para Cliente Móvil

**Sistema:** Gestión de Registros Clínicos Electrónicos (EHR/EMR)  
**Backend:** NestJS + PostgreSQL (Prisma ORM)  
**Base legal:** Ley 21.719 (Protección de Datos Personales, Chile)  
**Versión del documento:** 2026-05-24

---

## Índice

1. [Información General](#1-información-general)
2. [Autenticación](#2-autenticación)
3. [Usuarios](#3-usuarios)
4. [Pacientes](#4-pacientes)
5. [Encuentros Clínicos](#5-encuentros-clínicos)
6. [Condiciones / Diagnósticos](#6-condiciones--diagnósticos)
7. [Medicamentos](#7-medicamentos)
8. [Archivos Adjuntos](#8-archivos-adjuntos)
9. [Alertas Clínicas](#9-alertas-clínicas)
10. [Consentimientos Clínicos](#10-consentimientos-clínicos)
11. [Consentimientos de Datos (Ley 21.719)](#11-consentimientos-de-datos-ley-21719)
12. [Portal del Paciente](#12-portal-del-paciente)
13. [Plantillas de Texto](#13-plantillas-de-texto)
14. [Búsqueda CIE-10](#14-búsqueda-cie-10)
15. [Análisis Clínico](#15-análisis-clínico)
16. [Auditoría](#16-auditoría)
17. [Configuración](#17-configuración)
18. [Documentos Legales](#18-documentos-legales)
19. [Onboarding](#19-onboarding)
20. [Derechos de Datos — Ley 21.719](#20-derechos-de-datos--ley-21719)
21. [Brechas de Datos](#21-brechas-de-datos)
22. [Administración de Usuarios](#22-administración-de-usuarios)
23. [Health & Métricas](#23-health--métricas)
24. [Modelos de Datos](#24-modelos-de-datos)
25. [Roles y Permisos](#25-roles-y-permisos)
26. [Seguridad y Throttle](#26-seguridad-y-throttle)
27. [Checklist Móvil — Endpoints Esenciales](#27-checklist-móvil--endpoints-esenciales)

---

## 1. Información General

### Stack técnico

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js ≥ 20 |
| Framework | NestJS v11 |
| ORM | Prisma v5.8 |
| Base de datos | PostgreSQL |
| Auth | JWT + TOTP (2FA) |
| Cifrado | AES-256-GCM (campos sensibles) |
| PDF | pdfkit |
| Email | nodemailer |
| Monitoreo | Sentry + Prometheus |

### Convenciones de API

- Todas las rutas llevan prefijo `/api` (o el que defina `app.setGlobalPrefix`)
- Autenticación mediante cookie `httpOnly` (web) **o** header `Authorization: Bearer <token>` (móvil)
- Errores en formato `{ statusCode, message, error }`
- Paginación con query params `page` y `limit`

### Header obligatorio para clientes móviles

Toda app nativa debe enviar en **todas las requests**:

```
X-Client-Type: mobile
```

Efectos de este header:

1. **CSRF middleware queda exento** — no necesitas enviar `X-CSRF-Token` (las apps nativas no son vulnerables a CSRF: el ataque requiere un navegador enviando cookies ambient a un origen tercero, lo cual no aplica).
2. **Endpoints de autenticación devuelven los tokens en el body** además de setearlos como cookies (que la app ignora). Esto te permite guardarlos en almacenamiento seguro (Keychain en iOS, Keystore en Android) y enviarlos como Bearer.
3. **Refresh y logout aceptan el `refreshToken` en el body** (no solo desde cookie).

### Flujo de autenticación móvil

```
POST /api/auth/login
Headers:
  X-Client-Type: mobile
  Content-Type: application/json
Body:
  { "email": "...", "password": "..." }

Respuesta:
  {
    "message": "Inicio de sesión exitoso",
    "user": { ... },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc..."
    }
  }
```

En las requests siguientes:

```
GET /api/patients
Headers:
  X-Client-Type: mobile
  Authorization: Bearer <accessToken>
```

Cuando el access token expira (401):

```
POST /api/auth/refresh
Headers:
  X-Client-Type: mobile
  Content-Type: application/json
Body:
  { "refreshToken": "eyJhbGc..." }

Respuesta:
  {
    "message": "Tokens actualizados",
    "tokens": { "accessToken": "...", "refreshToken": "..." }
  }
```

Logout:

```
POST /api/auth/logout
Headers:
  X-Client-Type: mobile
  Content-Type: application/json
Body:
  { "refreshToken": "eyJhbGc..." }
```

> El mismo flujo aplica al portal del paciente (`/api/portal/auth/*`), reemplazando los nombres de tokens.

### Códigos HTTP relevantes

| Código | Significado |
|--------|-------------|
| 200 | OK |
| 201 | Creado |
| 400 | Parámetros inválidos |
| 401 | Sin autenticación |
| 403 | Rol insuficiente |
| 404 | Recurso no encontrado |
| 409 | Conflicto (duplicado) |
| 422 | Validación fallida |
| 429 | Rate limit excedido |
| 503 | Base de datos no disponible |

---

## 2. Autenticación

**Prefijo:** `/auth`  
**Protección:** Pública salvo donde se indica

### Flujo de login con 2FA

```
POST /auth/login → recibe JWT o señal de 2FA pendiente
POST /auth/2fa/verify → confirma TOTP y entrega token final
```

### Endpoints

| Método | Ruta | Descripción | Throttle |
|--------|------|-------------|---------|
| POST | `/auth/register` | Registrar usuario con token de invitación | 3/min |
| POST | `/auth/login` | Iniciar sesión (email + password) | 5/min |
| POST | `/auth/logout` | Cerrar sesión (revoca token) | — |
| POST | `/auth/refresh` | Refrescar access token con refresh cookie | — |
| GET | `/auth/me` | Datos del usuario autenticado | — |
| GET | `/auth/bootstrap` | Estado inicial de la app (público) | — |
| PATCH | `/auth/profile` | Actualizar perfil propio | — |
| POST | `/auth/change-password` | Cambiar contraseña | — |
| GET | `/auth/invitations/:token` | Preview de invitación | — |

### Sesiones

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/auth/sessions` | Listar sesiones activas propias |
| DELETE | `/auth/sessions/:id` | Revocar sesión específica |
| DELETE | `/auth/sessions/others` | Revocar todas las demás sesiones |

### Recuperación de contraseña

| Método | Ruta | Descripción | Throttle |
|--------|------|-------------|---------|
| POST | `/auth/forgot-password` | Solicitar reset por email | 2/min |
| GET | `/auth/forgot-password/:token` | Validar token de reset | 10/min |
| POST | `/auth/forgot-password/confirm` | Confirmar nueva contraseña | 5/min |

### 2FA (TOTP)

| Método | Ruta | Descripción | Throttle |
|--------|------|-------------|---------|
| POST | `/auth/2fa/setup` | Obtener secreto TOTP y QR | — |
| POST | `/auth/2fa/enable` | Habilitar 2FA (requiere verificación) | — |
| POST | `/auth/2fa/disable` | Deshabilitar 2FA | — |
| POST | `/auth/2fa/recovery-codes/regenerate` | Regenerar códigos de recuperación | — |
| POST | `/auth/2fa/verify` | Verificar código TOTP en login | 5/min |

### Cookies de sesión

| Cookie | Descripción |
|--------|-------------|
| `access_token` | JWT de acceso (httpOnly, secure, sameSite=strict) |
| `refresh_token` | Token de renovación (httpOnly, secure) |
| `patient_access_token` | Token del portal del paciente |
| `patient_refresh_token` | Refresh del portal del paciente |

---

## 3. Usuarios

**Prefijo:** `/users`  
**Roles requeridos:** ADMIN

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/users` | Listar todos los usuarios |
| POST | `/users` | Crear nuevo usuario |
| GET | `/users/:id` | Obtener usuario por ID |
| PUT | `/users/:id` | Actualizar usuario |
| DELETE | `/users/:id` | Eliminar usuario |
| POST | `/users/:id/reset-password` | Resetear contraseña temporal |

### Invitaciones de usuario

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/users/invitations` | Listar invitaciones pendientes |
| POST | `/users/invitations` | Crear invitación |
| DELETE | `/users/invitations/:id` | Revocar invitación |

---

## 4. Pacientes

**Prefijo:** `/patients`  
**Roles:** ADMIN, MEDICO, ASISTENTE (según acción)

### 4.1 Lectura y búsqueda

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/patients` | Listar pacientes con filtros | ADMIN, MEDICO, ASISTENTE |
| GET | `/patients/:id` | Obtener paciente completo | MEDICO, ASISTENTE |
| GET | `/patients/:id/clinical-summary` | Resumen clínico del paciente | MEDICO, ASISTENTE |
| GET | `/patients/:id/encounters` | Timeline de encuentros | MEDICO, ASISTENTE |
| GET | `/patients/:id/operational-history` | Historial de cambios | MEDICO, ASISTENTE |
| GET | `/patients/:id/admin-summary` | Resumen administrativo | ADMIN |
| GET | `/patients/possible-duplicates` | Buscar duplicados | MEDICO, ASISTENTE |
| GET | `/patients/tasks` | Tareas clínicas del usuario | MEDICO, ASISTENTE |
| GET | `/patients/export/csv` | Exportar listado a CSV | ADMIN |

#### Query params para `GET /patients`

| Param | Tipo | Descripción |
|-------|------|-------------|
| `search` | string | Búsqueda por nombre/RUT |
| `page` | number | Página (default: 1) |
| `limit` | number | Resultados por página |
| `sexo` | string | Filtro por sexo biológico |
| `prevision` | string | Filtro por previsión |
| `completenessStatus` | string | Estado de completitud del perfil |
| `taskWindow` | string | Filtro por ventana de tareas |
| `edadMin` / `edadMax` | number | Rango de edad |
| `clinicalSearch` | boolean | Búsqueda en historial clínico |
| `sortBy` / `sortOrder` | string | Ordenamiento |
| `archived` | boolean | Incluir archivados |

#### Query params para `GET /patients/:id/clinical-summary`

| Param | Valor | Descripción |
|-------|-------|-------------|
| `vitalHistory` | `full` \| `default` | Nivel de detalle de signos vitales |

### 4.2 Creación y actualización

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/patients` | Crear paciente completo | MEDICO |
| POST | `/patients/quick` | Crear paciente rápido (datos mínimos) | MEDICO, ASISTENTE |
| PUT | `/patients/:id` | Actualizar datos demográficos | MEDICO |
| PUT | `/patients/:id/admin` | Actualizar campos administrativos | MEDICO, ASISTENTE |
| PUT | `/patients/:id/history` | Actualizar historial médico | MEDICO, ASISTENTE |
| POST | `/patients/:id/verify-demographics` | Verificar datos demográficos | MEDICO |
| POST | `/patients/:id/merge` | Fusionar con otro paciente | MEDICO |
| POST | `/patients/:id/restore` | Restaurar paciente archivado | MEDICO |

### 4.3 Problemas clínicos y tareas

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/patients/:id/problems` | Crear problema/diagnóstico | MEDICO, ASISTENTE |
| PUT | `/patients/problems/:problemId` | Actualizar problema | MEDICO, ASISTENTE |
| POST | `/patients/:id/tasks` | Crear tarea clínica | MEDICO, ASISTENTE |
| PUT | `/patients/tasks/:taskId` | Actualizar estado de tarea | MEDICO, ASISTENTE |
| DELETE | `/patients/:id` | Eliminar paciente (soft delete) | MEDICO |

### 4.4 Exportaciones

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/patients/:id/export/pdf` | Historial longitudinal en PDF | MEDICO, ASISTENTE |
| GET | `/patients/:id/export/bundle` | Bundle completo en ZIP | MEDICO, ASISTENTE |
| GET | `/patients/:id/export/regulatory` | Datos regulatorios en ZIP (Ley 21.719) | ADMIN |

### 4.5 Regulatorio — Ley 21.719

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| DELETE | `/patients/:id/purge` | Purgar paciente definitivamente | ADMIN |
| POST | `/patients/:id/block` | Bloquear tratamiento de datos | ADMIN |
| POST | `/patients/:id/unblock` | Desbloquear tratamiento | ADMIN |

---

## 5. Encuentros Clínicos

**Prefijo:** `/encounters`  
**Roles:** MEDICO, ASISTENTE  
**Guard adicional:** `PatientNotBlockedGuard` — rechaza si el paciente está bloqueado

### 5.1 CRUD básico

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/encounters/patient/:patientId` | Crear nuevo encuentro | MEDICO, ASISTENTE |
| GET | `/encounters` | Listar encuentros del usuario | MEDICO, ASISTENTE |
| GET | `/encounters/:id` | Obtener encuentro detallado | MEDICO, ASISTENTE |
| GET | `/encounters/patient/:patientId` | Encuentros de un paciente | MEDICO, ASISTENTE |
| POST | `/encounters/:id/duplicate` | Duplicar encuentro | MEDICO, ASISTENTE |

#### Query params para `GET /encounters`

| Param | Descripción |
|-------|-------------|
| `status` | Filtrar por estado: `EN_PROGRESO`, `COMPLETADO`, `CANCELADO` |
| `search` | Búsqueda de texto |
| `reviewStatus` | `NO_REQUIERE_REVISION`, `REVISION_SOLICITADA`, `REVISADO` |
| `page` / `limit` | Paginación |

#### Query params para `GET /encounters/:id`

| Param | Tipo | Descripción |
|-------|------|-------------|
| `includeSignatureBaseline` | boolean | Incluir baseline de firma |
| `includeAttachments` | boolean | Incluir archivos adjuntos |
| `includeConsents` | boolean | Incluir consentimientos |
| `includeTasks` | boolean | Incluir tareas vinculadas |
| `includeSignatures` | boolean | Incluir datos de firma digital |
| `includeSuggestions` | boolean | Incluir sugerencias IA |

### 5.2 Estadísticas

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/encounters/stats/dashboard` | Estadísticas del dashboard |
| GET | `/encounters/stats/header` | Conteos resumen para cabecera |

### 5.3 Secciones del encuentro

| Método | Ruta | Descripción |
|--------|------|-------------|
| PUT | `/encounters/:id/sections/:sectionKey` | Actualizar sección específica |

Secciones disponibles (`:sectionKey`): `antecedentes`, `consulta`, `examen_fisico`, `diagnostico`, `tratamiento`, `indicaciones`, `derivacion`, y otras definidas en el schema.

### 5.4 Workflow del encuentro

| Método | Ruta | Descripción | Roles | Body requerido |
|--------|------|-------------|-------|----------------|
| POST | `/encounters/:id/complete` | Completar encuentro | MEDICO | `closureNote` |
| POST | `/encounters/:id/sign` | Firmar digitalmente | MEDICO | `password` |
| POST | `/encounters/:id/reopen` | Reabrir encuentro completado | MEDICO | `note`, `reasonCode` |
| POST | `/encounters/:id/cancel` | Cancelar encuentro | MEDICO | — |
| PUT | `/encounters/:id/review-status` | Actualizar estado de revisión | MEDICO, ASISTENTE | `reviewStatus`, `note` |
| POST | `/encounters/:id/reconcile-identification` | Reconciliar identificación del paciente | MEDICO, ASISTENTE | — |

### 5.5 Exportaciones del encuentro

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/encounters/:id/export/pdf` | Exportar encuentro a PDF |
| GET | `/encounters/:id/export/document/receta` | Exportar receta médica |
| GET | `/encounters/:id/export/document/ordenes` | Exportar órdenes de exámenes |
| GET | `/encounters/:id/export/document/derivacion` | Exportar derivación |
| GET | `/encounters/:id/audit` | Historial de auditoría del encuentro |

### 5.6 Estados del encuentro

```
EN_PROGRESO → COMPLETADO → (puede reabrirse) → EN_PROGRESO
           → CANCELADO
```

### 5.7 Estados de revisión

```
NO_REQUIERE_REVISION
REVISION_SOLICITADA
REVISADO
```

---

## 6. Condiciones / Diagnósticos

**Prefijo:** `/conditions`

### Catálogo global (ADMIN)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/conditions` | Buscar condiciones |
| GET | `/conditions/:id` | Obtener condición |
| GET | `/conditions/count` | Contar condiciones |
| POST | `/conditions` | Crear condición global |
| PUT | `/conditions/:id` | Actualizar condición global |
| DELETE | `/conditions/:id` | Eliminar condición global |
| POST | `/conditions/import/csv` | Importar desde CSV |
| POST | `/conditions/import/csv/preview` | Preview de importación CSV |

### Condiciones locales (MEDICO, ASISTENTE)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/conditions/local` | Crear condición propia |
| PUT | `/conditions/local/:id` | Actualizar condición propia |
| DELETE | `/conditions/local/:id` | Eliminar condición propia |
| DELETE | `/conditions/local/base/:baseId` | Ocultar condición global |

### Sugerencias IA

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/conditions/suggest` | Sugerir condiciones por texto (AI) |
| POST | `/conditions/encounters/:encounterId/suggestion` | Guardar sugerencia en encuentro |

---

## 7. Medicamentos

**Prefijo:** `/medications`

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/medications` | Buscar medicamentos | ADMIN, MEDICO, ASISTENTE |
| GET | `/medications/:id` | Obtener medicamento | ADMIN |
| POST | `/medications` | Crear medicamento global | ADMIN |
| PUT | `/medications/:id` | Actualizar medicamento | ADMIN |
| DELETE | `/medications/:id` | Eliminar medicamento | ADMIN |
| POST | `/medications/import/csv` | Importar desde CSV | ADMIN |
| POST | `/medications/import/csv/preview` | Preview de CSV | ADMIN |

---

## 8. Archivos Adjuntos

**Prefijo:** `/attachments`  
**Guard adicional:** `PatientNotBlockedGuard`  
**Límite:** 1 MB por archivo  
**Formatos:** PDF, JPG, PNG, DOC, DOCX

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/attachments/encounter/:encounterId` | Subir archivo | MEDICO, ASISTENTE |
| GET | `/attachments/encounter/:encounterId` | Listar archivos del encuentro | MEDICO, ASISTENTE |
| GET | `/attachments/:id/download` | Descargar archivo (descifrado) | MEDICO, ASISTENTE |
| DELETE | `/attachments/:id` | Eliminar archivo | MEDICO |

> Los archivos se almacenan cifrados (AES-256) y se descifran en memoria al descargar.

---

## 9. Alertas Clínicas

**Prefijo:** `/alerts`

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/alerts` | Crear alerta clínica | MEDICO |
| GET | `/alerts/unacknowledged-count` | Contar alertas no reconocidas | MEDICO, ASISTENTE |
| GET | `/alerts/unacknowledged` | Listar alertas no reconocidas | MEDICO, ASISTENTE |
| GET | `/alerts/patient/:patientId` | Alertas de un paciente | MEDICO, ASISTENTE |
| POST | `/alerts/:id/acknowledge` | Reconocer alerta | MEDICO |

---

## 10. Consentimientos Clínicos

**Prefijo:** `/consents`

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/consents` | Crear consentimiento informado | MEDICO, ASISTENTE |
| GET | `/consents/patient/:patientId` | Listar consentimientos del paciente | MEDICO, ASISTENTE |
| POST | `/consents/:id/revoke` | Revocar consentimiento | MEDICO |

#### Query params para `GET /consents/patient/:patientId`

| Param | Descripción |
|-------|-------------|
| `revokedLimit` | Máximo de consentimientos revocados a incluir |
| `withMeta` | Incluir metadatos adicionales |

---

## 11. Consentimientos de Datos (Ley 21.719)

**Prefijo:** `/patient-consents`  
**Normativa:** Art. 12 — Consentimiento del titular

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/patient-consents/patient/:patientId` | Listar consentimientos de datos del paciente |
| POST | `/patient-consents/grant` | Otorgar consentimiento de datos |
| POST | `/patient-consents/:id/revoke` | Revocar consentimiento de datos |

---

## 12. Portal del Paciente

**Prefijo:** `/portal`  
**Guard:** `PatientPortalAuthGuard` (token propio del portal)

### 12.1 Autenticación del portal (pública)

| Método | Ruta | Descripción | Throttle |
|--------|------|-------------|---------|
| POST | `/portal/auth/activate` | Activar cuenta con token de invitación | 5/min |
| POST | `/portal/auth/login` | Iniciar sesión en el portal | 5/min |
| POST | `/portal/auth/refresh` | Refrescar token del portal | — |
| POST | `/portal/auth/forgot-password` | Solicitar reset de contraseña | 2/min |
| POST | `/portal/auth/reset-password` | Confirmar nueva contraseña | 5/min |
| POST | `/portal/auth/logout` | Cerrar sesión en el portal | — |

### 12.2 Datos del portal (autenticado como paciente)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/portal/me` | Datos de la sesión del paciente |
| GET | `/portal/patient` | Información completa del paciente |
| GET | `/portal/encounters` | Encuentros del paciente |
| GET | `/portal/encounters/:id` | Detalle de un encuentro |
| GET | `/portal/encounters/:id/export/pdf` | Exportar encuentro a PDF |
| POST | `/portal/data-requests` | Crear solicitud de derechos de datos |

### 12.3 Invitar paciente al portal (admin)

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/admin/patients/:id/portal-invite` | Enviar invitación al portal | ADMIN |

---

## 13. Plantillas de Texto

**Prefijo:** `/templates`  
**Roles:** MEDICO, ASISTENTE

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/templates` | Listar plantillas del usuario |
| POST | `/templates` | Crear plantilla |
| POST | `/templates/install-defaults` | Instalar pack de plantillas por defecto |
| PUT | `/templates/:id` | Actualizar plantilla |
| DELETE | `/templates/:id` | Eliminar plantilla |

---

## 14. Búsqueda CIE-10

**Prefijo:** `/cie10`  
**Roles:** ADMIN, MEDICO, ASISTENTE

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/cie10/search` | Buscar códigos CIE-10 |

#### Query params

| Param | Descripción |
|-------|-------------|
| `q` | Término de búsqueda (mínimo 2 caracteres) |
| `limit` | Máximo de resultados (default: 20) |

---

## 15. Análisis Clínico

**Prefijo:** `/analytics`  
**Roles:** MEDICO

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/analytics/clinical/summary` | Resumen clínico |
| GET | `/analytics/clinical/summary/export/csv` | Exportar resumen a CSV |
| GET | `/analytics/clinical/summary/export/md` | Exportar resumen a Markdown |
| GET | `/analytics/clinical/cases` | Listado de casos clínicos |
| GET | `/analytics/clinical/cases/export/csv` | Exportar casos a CSV |

---

## 16. Auditoría

**Prefijo:** `/audit`  
**Roles:** ADMIN

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/audit` | Listar eventos de auditoría |
| GET | `/audit/integrity/verify` | Verificar integridad de la cadena de auditoría |
| GET | `/audit/integrity/latest` | Obtener snapshot más reciente |
| GET | `/audit/:entityType/:entityId` | Auditoría por entidad |

#### Query params para `GET /audit`

| Param | Descripción |
|-------|-------------|
| `page` / `limit` | Paginación |
| `entityType` | Tipo de entidad auditada |
| `userId` | Filtrar por usuario |
| `action` | CREATE, UPDATE, DELETE, VIEW, SIGN |
| `reason` | Razón registrada |
| `result` | SUCCESS, FAILURE |
| `requestId` | ID de solicitud específica |
| `dateFrom` / `dateTo` | Rango de fechas |

---

## 17. Configuración

**Prefijo:** `/settings`

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/settings` | Obtener todas las configuraciones | ADMIN |
| GET | `/settings/session-policy` | Obtener política de sesión | ADMIN, MEDICO, ASISTENTE |
| PUT | `/settings` | Actualizar configuraciones | ADMIN |

### Claves de configuración disponibles

| Clave | Descripción |
|-------|-------------|
| `clinic.name` | Nombre de la clínica |
| `clinic.identifier` | RUT o identificador |
| `clinic.logoUrl` | URL del logo |
| `clinic.address` | Dirección |
| `clinic.phone` | Teléfono |
| `clinic.email` | Email de contacto |
| `app.publicUrl` | URL pública de la aplicación |
| `smtp.*` | Configuración SMTP para emails |
| `email.*` | Plantillas y asuntos de email |
| `session.inactivityTimeoutMinutes` | Timeout de inactividad |

---

## 18. Documentos Legales

**Prefijo:** `/legal`

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/legal/documents/current` | Documentos legales vigentes | Público |
| GET | `/legal/documents/:type/current` | Documento específico vigente | Público |
| GET | `/legal/acceptances/me` | Aceptaciones del usuario actual | Autenticado |
| GET | `/legal/admin/documents` | Listar todos los documentos | ADMIN |
| POST | `/legal/admin/documents/draft` | Crear borrador | ADMIN |
| PATCH | `/legal/admin/documents/:id` | Actualizar borrador | ADMIN |
| POST | `/legal/admin/documents/:id/publish` | Publicar documento | ADMIN |

---

## 19. Onboarding

**Prefijo:** `/onboarding`  
**Roles:** Autenticado

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/onboarding/me` | Obtener progreso de onboarding |
| PATCH | `/onboarding/me` | Actualizar progreso |
| POST | `/onboarding/me/reset` | Resetear onboarding |

---

## 20. Derechos de Datos — Ley 21.719

### Endpoint público (Art. 4-11)

| Método | Ruta | Descripción | Throttle |
|--------|------|-------------|---------|
| POST | `/public/derechos` | Solicitar copia de datos personales | 5/10min |
| POST | `/public/data-request-downloads/:token/download` | Descargar datos (enlace temporal) | 10/10min |

### Panel administrativo

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/admin/data-requests` | Listar solicitudes de derechos | ADMIN |
| GET | `/admin/data-requests/:id` | Obtener solicitud | ADMIN |
| PATCH | `/admin/data-requests/:id` | Actualizar solicitud | ADMIN |
| POST | `/admin/data-requests/:id/extend` | Extender plazo de respuesta | ADMIN |
| POST | `/admin/data-requests/:id/resolve` | Resolver solicitud | ADMIN |
| POST | `/admin/data-requests/:id/export-link` | Crear enlace de descarga | ADMIN |
| POST | `/admin/data-request-downloads/:id/revoke` | Revocar enlace de descarga | ADMIN |

### Tipos de solicitud

| Valor | Descripción |
|-------|-------------|
| `ACCESO` | Acceder a sus datos |
| `COPIA` | Obtener copia de sus datos |
| `RECTIFICACION` | Corregir datos incorrectos |
| `OPOSICION` | Oponerse al tratamiento |
| `PORTABILIDAD` | Exportar datos a otro sistema |

### Estados de solicitud

```
PENDIENTE → EN_PROCESO → COMPLETADA
                       → RECHAZADA
```

---

## 21. Brechas de Datos

**Prefijo:** `/admin/data-breaches`  
**Roles:** ADMIN

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/admin/data-breaches` | Listar brechas reportadas |
| GET | `/admin/data-breaches/:id` | Detalle de una brecha |
| POST | `/admin/data-breaches` | Reportar nueva brecha |
| POST | `/admin/data-breaches/:id/assess` | Evaluar la brecha |
| POST | `/admin/data-breaches/:id/notify-agency` | Notificar a autoridad reguladora |
| POST | `/admin/data-breaches/:id/notify-subjects` | Notificar a afectados |
| POST | `/admin/data-breaches/:id/close` | Cerrar caso |

---

## 22. Administración de Usuarios

### Email de prueba

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/mail/test-invitation` | Enviar email de prueba de invitación | ADMIN |

---

## 23. Health & Métricas

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/health` | Health check básico | Público |
| GET | `/health/database` | Health check de base de datos | ADMIN |
| GET | `/metrics` | Métricas Prometheus | ADMIN / token Prometheus |

---

## 24. Modelos de Datos

### User

```typescript
{
  id: string (UUID)
  email: string
  passwordHash: string
  nombre: string
  role: 'ADMIN' | 'MEDICO' | 'ASISTENTE'
  medicoId?: string          // para asistentes: médico al que pertenecen
  totpSecret?: string
  totpEnabled: boolean
  totpRecoveryCodes?: string[]
  refreshTokenVersion: number
  createdAt: Date
  updatedAt: Date
}
```

### Patient

```typescript
{
  id: string (UUID)
  createdById: string

  // Datos demográficos (campos sensibles cifrados - Ley 21.719)
  rutExempt: boolean
  rutExemptReason?: string
  rutEnc?: string            // RUT cifrado AES-256-GCM
  rutLookupHash?: string     // Hash para búsqueda
  nombreEnc?: string         // Nombre cifrado
  telefonoEnc?: string       // Teléfono cifrado
  emailEnc?: string          // Email cifrado
  domicilioEnc?: string      // Domicilio cifrado
  contactoEmergenciaNombreEnc?: string
  contactoEmergenciaTelefonoEnc?: string

  fechaNacimiento?: Date
  edad?: number
  sexo?: string
  trabajo?: string
  prevision?: string

  // Ley 21.719
  blockedAt?: Date           // Bloqueo de tratamiento (Art 8 ter)
  blockedReason?: string
  processingObjections?: object

  completenessStatus: string
  demographicsVerifiedAt?: Date
  archivedAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

### Encounter

```typescript
{
  id: string (UUID)
  patientId: string
  medicoId: string
  createdById: string

  status: 'EN_PROGRESO' | 'COMPLETADO' | 'CANCELADO'
  reviewStatus: 'NO_REQUIERE_REVISION' | 'REVISION_SOLICITADA' | 'REVISADO'

  data: object               // Contenido clínico (JSON libre por sección)
  closureNote?: string

  signatureData?: object
  signedAt?: Date
  signedById?: string

  completedAt?: Date
  completedById?: string

  createdAt: Date
  updatedAt: Date
}
```

### Attachment

```typescript
{
  id: string (UUID)
  encounterId: string
  uploadedById: string

  filename: string
  mime: string
  sizeBytes: number

  encryptionAlgorithm: string
  encryptionKeyId: string
  storageLocation: string    // path local o S3

  downloadCount: number
  lastDownloadAt?: Date

  createdAt: Date
  deletedAt?: Date
}
```

### ClinicalConsent

```typescript
{
  id: string (UUID)
  patientId: string
  grantedById: string        // MEDICO o ASISTENTE

  type: string               // TRATAMIENTO | INVESTIGACION | etc.
  grantedAt: Date
  revokedAt?: Date
  revokedById?: string
  revocationReason?: string
}
```

### PatientDataProcessingConsent (Ley 21.719 Art 12)

```typescript
{
  id: string (UUID)
  patientId: string
  capturedById: string

  channel: 'PRESENCIAL_TABLET' | 'WEB_TITULAR'
  purpose: string[]          // Lista de finalidades

  grantedAt: Date
  revokedAt?: Date
}
```

### AuditLog

```typescript
{
  id: string (UUID)
  entityType: string
  entityId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'SIGN'

  userId: string
  result: 'SUCCESS' | 'FAILURE'
  reason?: string
  requestId?: string

  ipAddress?: string
  userAgent?: string
  context?: object

  createdAt: Date
}
```

---

## 25. Roles y Permisos

### Roles del sistema

| Rol | Descripción |
|-----|-------------|
| `ADMIN` | Administrador: gestión de usuarios, configuración, auditoría, cumplimiento legal |
| `MEDICO` | Médico: crear y firmar encuentros, gestionar pacientes |
| `ASISTENTE` | Asistente: apoyo en encuentros, acceso limitado |

### Jerarquía

```
ADMIN > MEDICO > ASISTENTE
```

### Guards disponibles

| Guard | Propósito |
|-------|-----------|
| `JwtAuthGuard` | Valida JWT en cookie o header Authorization |
| `RolesGuard` | Valida el rol del usuario |
| `AdminGuard` | Solo ADMIN |
| `PatientNotBlockedGuard` | Rechaza si el paciente está bloqueado (Ley 21.719 Art 8 ter) |
| `PatientPortalAuthGuard` | Autenticación propia del portal del paciente |
| `UserThrottlerGuard` | Rate limiting por usuario/IP |
| `MetricsAccessGuard` | Acceso a `/metrics` (token Prometheus o ADMIN) |

---

## 26. Seguridad y Throttle

### Límites de tasa (producción)

| Ventana | Límite |
|---------|--------|
| 1 segundo | 20 requests |
| 10 segundos | 120 requests |
| 60 segundos | 600 requests |

### Throttle por endpoint (límites específicos)

| Endpoint | Límite |
|----------|--------|
| `POST /auth/register` | 3/min |
| `POST /auth/login` | 5/min |
| `POST /auth/forgot-password` | 2/min |
| `GET /auth/forgot-password/:token` | 10/min |
| `POST /auth/forgot-password/confirm` | 5/min |
| `POST /auth/2fa/verify` | 5/min |
| `POST /portal/auth/activate` | 5/min |
| `POST /portal/auth/login` | 5/min |
| `POST /portal/auth/forgot-password` | 2/min |
| `POST /portal/auth/reset-password` | 5/min |
| `POST /public/derechos` | 5/10min |
| `POST /public/data-request-downloads/:token/download` | 10/10min |

### Cifrado de campos (Ley 21.719)

Los siguientes campos de pacientes están cifrados con AES-256-GCM:

- RUT (`rutEnc`) + hash de búsqueda (`rutLookupHash`)
- Nombre (`nombreEnc`)
- Teléfono (`telefonoEnc`)
- Email (`emailEnc`)
- Domicilio (`domicilioEnc`)
- Contacto de emergencia (nombre + teléfono)

### Seguridad de archivos adjuntos

- Almacenados cifrados en disco (AES-256)
- Descifrados en memoria al descargar
- Verificación de integridad con hash HMAC

---

## 27. Checklist Móvil — Endpoints Esenciales

Listado priorizado de endpoints para un MVP del cliente móvil:

### Autenticación (flujo completo)

- [ ] `POST /auth/login` — Login inicial
- [ ] `POST /auth/2fa/verify` — Verificar TOTP si aplica
- [ ] `POST /auth/refresh` — Refrescar token en background
- [ ] `POST /auth/logout` — Cerrar sesión
- [ ] `GET /auth/me` — Datos del usuario actual
- [ ] `GET /auth/bootstrap` — Estado inicial de la app

### Pacientes

- [ ] `GET /patients` — Listado con búsqueda y filtros
- [ ] `GET /patients/:id` — Perfil completo
- [ ] `GET /patients/:id/clinical-summary` — Resumen clínico
- [ ] `POST /patients/quick` — Crear paciente rápido
- [ ] `PUT /patients/:id/admin` — Actualizar datos admin

### Encuentros

- [ ] `GET /encounters` — Listado propio con filtros
- [ ] `GET /encounters/stats/header` — Conteos para la cabecera
- [ ] `POST /encounters/patient/:patientId` — Crear encuentro
- [ ] `GET /encounters/:id` — Detalle de encuentro
- [ ] `PUT /encounters/:id/sections/:sectionKey` — Editar sección
- [ ] `POST /encounters/:id/complete` — Completar encuentro
- [ ] `GET /encounters/:id/export/pdf` — PDF del encuentro

### Alertas

- [ ] `GET /alerts/unacknowledged-count` — Badge de alertas
- [ ] `GET /alerts/unacknowledged` — Listado de alertas
- [ ] `POST /alerts/:id/acknowledge` — Reconocer alerta

### Búsqueda clínica

- [ ] `GET /cie10/search` — Buscar diagnósticos CIE-10
- [ ] `GET /conditions` — Buscar condiciones
- [ ] `GET /medications` — Buscar medicamentos

### Archivos adjuntos

- [ ] `GET /attachments/encounter/:encounterId` — Listar archivos
- [ ] `POST /attachments/encounter/:encounterId` — Subir archivo
- [ ] `GET /attachments/:id/download` — Descargar archivo

### Configuración y política de sesión

- [ ] `GET /settings/session-policy` — Timeout de inactividad

### Portal del paciente (si se implementa vista para pacientes)

- [ ] `POST /portal/auth/login`
- [ ] `GET /portal/patient`
- [ ] `GET /portal/encounters`
- [ ] `GET /portal/encounters/:id`
- [ ] `GET /portal/encounters/:id/export/pdf`

---

*Generado automáticamente el 2026-05-24 desde el análisis del codebase de Anamneo.*
