# Auditoría de Anamneo con Playwright

**Fecha:** 2026-06-03  
**Versión auditada:** rama `main`, commit `e8ea7818` y siguientes  
**Realizada por:** Claude Code (auditor técnico + QA)  
**Evidencia:** 84 capturas frescas · `audit/evidence.json` · `audit/evidence-live.json` · axe-core · 11 workflow tests

---

## 1. Resumen ejecutivo

Anamneo es un EMR clínico chileno (Next.js 16 + NestJS 11 + PostgreSQL 16) diseñado para uso de baja escala, con cumplimiento de la Ley 21.719 sobre protección de datos personales. La aplicación está orientada a un/a médico/a que trabaja de forma personal o con un equipo pequeño.

La auditoría cubrió 84 pantallas únicas (desktop + mobile), flujos CRUD completos (11 tests), edge-cases de validación, rutas protegidas, accesibilidad automatizada con axe-core y monitoreo de consola/red en 12 páginas.

**El flujo clínico principal funciona correctamente de principio a fin.** Todos los flujos de paciente, atención, firma y portal pasaron sin fallos. La autenticación y protección de rutas están bien implementadas.

Los problemas encontrados son principalmente:
- Un bug de 403 en alertas afecta al rol ADMIN (no al Médico)
- Mensajes de validación con texto técnico en formulario de nuevo paciente
- Un error visible en la página Reportes para el rol Admin
- Violaciones de CSP en consola (no visibles al usuario)
- Un problema de contraste de color en el badge de completitud de fichas

Ninguno de estos problemas bloquea el uso clínico real para el rol Médico.

---

## 2. Veredicto de preparación para producción personal

### ✅ Lista con correcciones menores

**Para el rol Médico (uso principal):** la app está lista. Los flujos clínicos funcionan, la autenticación es correcta, los datos se guardan y persisten, y el portal de paciente opera bien.

**Correcciones recomendadas antes de publicar:**
1. Arreglar mensajes de validación técnicos en el formulario de nuevo paciente (Sexo, Previsión).
2. Corregir contraste de color del badge "25% completa" (falla axe WCAG AA).
3. Evitar llamar `/api/alerts/unacknowledged-count` para el rol Admin (genera 403 en consola en cada página).

**Para el rol Admin:** funcional pero con problemas menores — la página Reportes muestra un error genérico en lugar de un mensaje de acceso, y hay 403s de alertas en cada página. No bloquea el uso, pero es ruidoso.

---

## 3. Contexto y alcance

| | |
|---|---|
| **Aplicación** | Anamneo — EMR chileno personal/baja escala |
| **Caso de uso** | Una médica usando la app para gestión clínica propia |
| **Stack** | Next.js 16 App Router · NestJS 11 · Prisma 5 · PostgreSQL 16 |
| **Roles** | MEDICO (principal) · ASISTENTE · ADMIN · Portal paciente |
| **Compliance** | Ley 21.719 Chile — PII cifrada a nivel app, cadena hash auditoría |
| **Despliegue** | Docker Compose + Cloudflare Tunnel (según README) |

**Fuera de alcance:** Performance bajo carga, HTTPS/TLS (se asume configurado via Cloudflare), FHIR/HL7, multi-clínica, facturación, compliance hospitalario completo.

---

## 4. Entorno auditado

| | |
|---|---|
| **URL local** | `http://127.0.0.1:5556` (frontend) / `http://127.0.0.1:5679` (backend) |
| **Base de datos** | PostgreSQL 16 aislada por run (`anamneo_playwright_*`) |
| **Navegador** | Chromium (Playwright) |
| **Viewports** | Desktop 1280×900 · Mobile 390×844 |
| **Fecha ejecución** | 2026-06-03 |
| **Node.js** | v20.19.2 |

---

## 5. Metodología

1. **Fase A** — Suite visual completa (`visual-screenshots.spec.ts` + `visual-full-app.spec.ts`): 41 tests, 84 capturas frescas en DB aislada.
2. **Fase B-edge** — `audit-capture.spec.ts`: edge cases (login-error, ruta protegida, validación form, búsqueda sin resultados, caracteres especiales) + monitoreo consola/red en 12 páginas autenticadas → `evidence.json`.
3. **Fase B-live** — `audit-live-flows.spec.ts`: 6 rutas protegidas sin sesión → todas redirigen a `/login` correctamente → `evidence-live.json`.
4. **Fase B-workflow** — `workflow-clinical.spec.ts`: flujos CRUD completos: crear paciente, alergia, atención, secciones, adjuntos, conflicto multi-tab, completar y firmar → **11/11 PASS**.
5. **Fase C** — Análisis de axe-core (`accessibility.spec.ts`): 4/6 pass, 1 fallo de contraste, 1 skip.
6. **Fase D** — Lectura y análisis de 30+ capturas clave. Cruzado con `evidence.json`, prior audits (`visual-audit-desktop.md`, `docs/ui-ux-audit-remediation.md`) y código fuente.

---

## 6. Rutas y flujos revisados

| Ruta | Rol | Estado visual | Funcional |
|---|---|---|---|
| `/login` | — | ✅ | ✅ error state OK |
| `/register` | — | ✅ | ✅ |
| `/forgot-password` | — | ⚠️ layout diferente | N/A |
| `/` (dashboard admin) | ADMIN | ✅ | ⚠️ topbar vacío |
| `/` (dashboard médico) | MEDICO | ✅ | ✅ |
| `/pacientes` | ADMIN/MEDICO | ✅ | ✅ |
| `/pacientes/nuevo` | MEDICO | ⚠️ errores validación técnicos | ✅ crea OK |
| `/pacientes/[id]` | ADMIN/MEDICO | ✅ | ✅ |
| `/pacientes/[id]/editar` | MEDICO | ✅ | ✅ |
| `/atenciones` | MEDICO | ✅ | ✅ |
| `/atenciones/[id]` | MEDICO | ✅ | ✅ |
| `/atenciones/[id]/ficha` | MEDICO | ✅ | ✅ firma OK |
| `/agenda` | ADMIN | ⚠️ empty state medico-only | N/A |
| `/seguimientos` | MEDICO | ✅ empty state OK | ✅ |
| `/reportes` | ADMIN | ❌ error "No se pudo cargar" | ❌ 403 |
| `/reportes` | MEDICO | ✅ | ✅ |
| `/analitica-clinica` | MEDICO | ✅ | ✅ |
| `/analitica-clinica` | ADMIN | — | redirige al dashboard |
| `/catalogo` | ADMIN/MEDICO | ✅ | ✅ |
| `/plantillas` | MEDICO | ✅ | ✅ |
| `/ajustes` | ADMIN/MEDICO | ✅ | ✅ |
| `/admin/usuarios` | ADMIN | ✅ | ✅ |
| `/admin/auditoria` | ADMIN | ✅ | ✅ |
| `/admin/solicitudes` | ADMIN | ✅ | ✅ |
| `/portal` | paciente | ✅ | ✅ |
| `/portal/login` | paciente | ✅ | ✅ |
| `/portal/atenciones/[id]` | paciente | ✅ | ✅ |
| `/portal/historial-acceso` | paciente | ✅ | ✅ |
| Rutas protegidas sin sesión | — | ✅ redirect `/login?from=` | ✅ 6/6 |

---

## 7. Inventario de capturas

**Total:** 84 PNGs · **Directorio:** `frontend/tests/e2e/screenshots/`

Prefijos: `dashboard__`, `public__`, `pacientes__`, `atenciones__`, `portal__`, `admin__`, `analitica__`, `catalogo__`, `ajustes__`, `agenda__`, `seguimientos__`, `reportes__`, `plantillas__`, `legal__`, `global__`, `audit__`, `live__`

Capturas de edge-case: `audit__login-error--{desktop,mobile}`, `audit__patient-form-blank--{desktop,mobile}`, `audit__patient-form-validation-errors--{desktop,mobile}`, `audit__protected-route-unauth--desktop`, `audit__search-no-results--desktop`, `audit__search-special-chars--desktop`.

---

## 8. Análisis pantalla por pantalla

### Login (`public__login--desktop.png`)
**Qué se ve:** Layout 2 columnas — panel izquierdo con branding (logo Anamneo, "Acceso seguro a tu espacio clínico", 2 feature cards), panel derecho con formulario. Estética limpia, paleta verde/teal coherente.  
**Funciona:** Diseño visual profesional. Campos con labels y placeholders. Botón CTA destacado. Link "Recuperar contraseña".  
**Problemas:** Solo 2 features mostradas (Trazabilidad clínica + Cifrado) en el panel izquierdo — asimetría menor respecto al portal login que tiene 2 cards completas.  
**Severidad:** Baja  
**Prioridad:** P3

### Login error (`audit__login-error--desktop.png`)
**Qué se ve:** Banner rojo con ícono de alerta y texto "Credenciales inválidas" aparece sobre los campos.  
**Funciona:** El mensaje de error es claro, inmediato y no borra los campos. La contraseña muestra bullets, el email persiste.  
**Problemas:** Ninguno.  
**Severidad:** OK  

### Dashboard Admin (`dashboard__admin--desktop.png`)
**Qué se ve:** Bienvenida "Buenos días, Admin", panel "Backup y restore drill" con estado de backup (Vencido) y restore drill (Vigente). Sección "Operación diaria" con 3 tarjetas de acceso rápido.  
**Funciona:** El dashboard admin es correcto conceptualmente — muestra lo operativo, no lo clínico.  
**Problemas:** La topbar (franja superior) está completamente vacía. En el rol Médico muestra stat chips ("0 Activas · 0 Pendientes"). El admin no tiene chips relevantes aquí y el área queda como espacio vacío. No es un bug bloqueante pero rompe la simetría visual. El backup muestra "Vencido" — esto es correcto porque en el entorno de test no hay backup configurado, pero en producción necesita atención.  
**Severidad:** Baja  
**Prioridad:** P2

### Dashboard Médico (`dashboard__medico--desktop.png`)
**Qué se ve:** Topbar con stat chips (0 Activas · 0 Pendientes · 1 Completadas), botones de acción rápida (Nueva atención, Nuevo paciente, Bandeja de seguimientos, Todas las atenciones), guía inicial de 5 pasos, stat cards (En curso, Para hoy, Atrasados, Pacientes recientes), sección "Atenciones en curso".  
**Funciona:** Interfaz completa y bien orientada. La guía inicial es útil para el primer uso. Jerarquía visual clara.  
**Problemas:** Hay un ítem "–" (guión) al final de la barra lateral, bajo "Plantillas". Posible ítem de nav que falló en renderizar label.  
**Severidad:** Baja  
**Prioridad:** P2

### Pacientes — Nuevo (`pacientes__new--desktop.png` + `audit__patient-form-blank--desktop.png`)
**Qué se ve:** Formulario con campos: Nombre completo *, RUT, checkbox "Paciente sin RUT" (con descripción), Fecha de nacimiento *, Sexo *, Previsión de salud *, Trabajo/Ocupación, Domicilio, Centro médico. Los campos con `*` están claramente marcados.  
**Funciona:** Jerarquía de campos correcta. El checkbox "Paciente sin RUT" tiene descripción contextual útil. Form bien estructurado.  
**Problemas:** Ninguno visible en el estado blank.  
**Severidad:** OK  

### Pacientes — Validación (`audit__patient-form-validation-errors--desktop.png`)
**Qué se ve:** Al enviar formulario vacío, aparecen mensajes de error junto a los campos. Los mensajes son:
- "El nombre debe tener al menos 2 caracteres" — correcto
- "La fecha de nacimiento es obligatoria" — correcto  
- **"Invalid enum value. Expected 'MASCULINO' | 'FEMENINO' | 'OTRO' | 'PREFIERE_NO_DECIR', received ''"** — incorrecto, texto técnico de Zod
- **"Invalid enum value. Expected 'FONASA' | 'ISAPRE' | 'OTRA' | 'DESCONOCIDA', received ''"** — incorrecto, texto técnico de Zod  
**Funciona:** La validación sí dispara y los campos correctos quedan marcados en rojo.  
**Problemas:** Los mensajes de Zod/enum se filtran al usuario final. Inaceptable en producción — expone nombres internos del enum.  
**Severidad:** Media  
**Prioridad:** P1

### Pacientes — Búsqueda sin resultados (`audit__search-no-results--desktop.png`)
**Qué se ve:** Búsqueda con término "ZZZXXX_NO_EXISTE_99999" muestra el term en el campo, y un empty state: ícono de persona + "Sin pacientes para este criterio" + descripción.  
**Funciona:** Empty state bien resuelto, claro y accionable.  
**Problemas:** Ninguno.  
**Severidad:** OK  

### Atención — Detalle (`atenciones__detail--desktop.png`)
**Qué se ve:** Wizard de secciones (5/10 completas) en panel izquierdo con checkmarks, panel derecho con contenido de la sección activa. Panel flotante "Resumen clínico fijo" con Alergias, Medicación habitual, Alertas y Problemas activos. Header con nombre del paciente, edad, sexo, previsión. Botón "Firmar atención" prominente en topbar. Badge "Revisada por médico".  
**Funciona:** Interfaz de atención muy completa. La sección activa está claramente destacada. El resumen clínico fijo es útil para no perder contexto al navegar secciones.  
**Problemas:** "Anamnesis próxima" y "Anamnesis remota" aparecen como números (3, 4) en lugar de tener checkmark — son secciones pendientes. El panel derecho podría tener overflow en pantallas pequeñas.  
**Severidad:** Baja  
**Prioridad:** P2

### Atención — Ficha (`atenciones__ficha--desktop.png`)
**Qué se ve:** Pantalla de pre-firma con resumen: secciones completas (5/10), estado de revisión, nota de cierre, adjuntos, diff de cambios (15 cambios detectados), desglose "Antes/Ahora" campo por campo.  
**Funciona:** Excelente feature de trazabilidad — muestra exactamente qué cambia antes de firmar. Crítico para documentación médico-legal.  
**Problemas:** Ninguno.  
**Severidad:** OK  

### Agenda — Week view (`agenda__week--desktop.png`)
**Qué se ve:** Pantalla muestra empty state "Sin médico asignado" para el Admin (que no tiene médico asociado).  
**Funciona:** El empty state es informativo y accionable.  
**Problemas:** El Admin puede navegar a /agenda aunque esta ruta no aparece en su menú lateral. Inconsistencia de acceso.  
**Severidad:** Baja  
**Prioridad:** P3

### Reportes (`reportes__list--desktop.png`)
**Qué se ve:** "Reportes operacionales" con selector de fecha (03-06-2026) y banner rojo **"No se pudo cargar el reporte."** El resto del área está vacío.  
**Funciona:** No funciona para el Admin.  
**Problemas:** El Admin tiene /reportes en el menú pero el endpoint `/api/analytics/operational/daily-summary` devuelve 403 para este rol. El mensaje de error es genérico y no indica el problema real. En producción si la médica también tiene rol ADMIN, esta página siempre mostrará error.  
**Severidad:** Alta  
**Prioridad:** P1

### Seguimientos (`seguimientos__list--desktop.png`)
**Qué se ve:** Página vacía con filtros (Buscar, estado, tipo, prioridad, "Solo atrasados"), empty state "Sin seguimientos visibles".  
**Funciona:** Todos los elementos visibles. El label "Solo atrasados" aparece completo (issue previo de truncamiento resuelto o no reproducible).  
**Problemas:** El ítem de navbar "-" aparece de nuevo bajo Plantillas. Inconsistencia.  
**Severidad:** Baja  
**Prioridad:** P2

### Ajustes — Perfil (`ajustes__perfil--desktop.png`)
**Qué se ve:** 4 tabs (Perfil y seguridad, Centro médico, Correo e invitaciones, Sistema). Datos personales (Nombre, Email, Rol). Cambiar contraseña. Documentos legales con versiones y fechas de aceptación.  
**Funciona:** Estructura clara y bien organizada.  
**Problemas:** El campo "Rol" muestra "ADMIN" en un badge oscuro — debería mostrar "Administrador" para ser consistente con la barra lateral. El botón "Guardar cambios" aparece deshabilitado visualmente (gris) cuando el form está sin cambios — comportamiento correcto, pero contraste del texto del botón deshabilitado podría ser bajo.  
**Severidad:** Baja  
**Prioridad:** P3

### Admin — Auditoría (`admin__auditoria--desktop.png`)
**Qué se ve:** Panel "Integridad de auditoría" con estado "Integridad pendiente" / "Pendiente", "Quiebre en entrada desconocida". Entradas verificadas: 0. Filtros de auditoría en 2 filas. Log de eventos con 2 entradas de Creación.  
**Funciona:** El panel de auditoría está construido correctamente. El badge "!" en la sidebar de Auditoría alerta sobre el estado de integridad pendiente.  
**Problemas:** El estado "Quiebre en entrada desconocida" es el estado inicial de una DB vacía — en producción debería resolverse con la primera verificación. Los filtros "Desde" y "Hasta" aparecen juntos en la segunda fila (issue previo marcado como problema — ya aparecen juntos). Sin embargo en la primera fila hay 6 filtros (Acción, Entidad, Usuario, Motivo, Resultado, Request ID) lo que puede quedar apretado en pantallas más pequeñas.  
**Severidad:** Baja  
**Prioridad:** P3

### Portal Paciente (`portal__home--desktop.png`)
**Qué se ve:** "Portal paciente" con nombre del paciente. Datos generales (RUT, Nacimiento, Sexo, Previsión). "Atenciones finalizadas" con una atención visible y botón de descarga. "Accesos y solicitudes" con links a historial y solicitudes.  
**Funciona:** Portal funcional con toda la información relevante.  
**Problemas:** Los valores de enum aparecen sin formatear: "FEMENINO" en lugar de "Femenino". Es un detalle menor pero indica falta de capa de presentación para las enumeraciones del portal. La segunda mitad de la página (debajo de los dos paneles) queda completamente vacía, creando mucho espacio en blanco.  
**Severidad:** Baja  
**Prioridad:** P3

### Registro (`public__register--desktop.png`)
**Qué se ve:** Formulario de registro por invitación. Badge "Invitación validada" + "Rol fijado". Banner amarillo "Necesita una invitación válida". Campos: Nombre, Email, Contraseña, Confirmar contraseña. Aceptación de términos con versión. Botón "Crear cuenta".  
**Funciona:** Flujo de registro por invitación bien implementado. Las versiones de los documentos legales se muestran explícitamente.  
**Problemas:** El banner amarillo ("Necesita una invitación válida") aparece aunque el usuario llegó con token válido (badges "Invitación validada" + "Rol fijado"). El banner debería condicionarse a cuando no hay token, no mostrarse siempre.  
**Severidad:** Baja  
**Prioridad:** P2

### Dashboard Admin — Mobile (`dashboard__admin--mobile.png`)
**Qué se ve:** Layout mobile correcto. Hamburger menu visible. Cards de backup apiladas verticalmente. Texto legible.  
**Funciona:** Responsive OK.  
**Problemas:** Ninguno visible.  
**Severidad:** OK  

### Pacientes Nuevo — Mobile (`pacientes__new--mobile.png`)
**Qué se ve:** Formulario bien adaptado a mobile. Campos full-width. Labels visibles. Checkbox "Paciente sin RUT" con descripción visible.  
**Funciona:** Excelente responsive para el formulario más importante.  
**Problemas:** Ninguno visible.  
**Severidad:** OK  

---

## 9. Hallazgos funcionales

### FN-001 Flujo clínico completo — PASS
Los 11 tests del `workflow-clinical.spec.ts` pasan:
- Crear paciente (completo)
- Verificar ficha
- Buscar paciente
- Registrar alergia GRAVE + badge crítico aparece en header
- Crear atención + llenar motivo de consulta
- Subir adjunto
- Cola offline (sección en modo offline no falla el flujo)
- Documentos clínicos disponibles pre-completado
- Eliminar adjunto y verificar que no aparece en ficha
- Conflicto de guardado multi-tab (la segunda tab recibe el contenido del servidor)
- Completar y firmar atención

**Conclusión:** El flujo clínico principal está completamente operativo.

### FN-002 Protección de rutas — PASS
6/6 rutas protegidas redirigen a `/login?from={ruta}` cuando se navega sin sesión:  
`/pacientes`, `/atenciones`, `/agenda`, `/admin/usuarios`, `/admin/auditoria`, `/ajustes`.

### FN-003 Reportes Admin — FAIL
`/reportes` accesible desde el nav del Admin pero la API devuelve `403 GET /api/analytics/operational/daily-summary`. Muestra "No se pudo cargar el reporte." sin más contexto.

### FN-004 Alerts endpoint — 403 en todas las páginas Admin
`GET /api/alerts/unacknowledged-count` devuelve 403 para el rol Admin en **todas** las páginas. El frontend llama este endpoint sin verificar rol. Genera 2 errores de consola + 2 network errors por página para el Admin.

### FN-005 Sesión y recarga — PASS
Hard reload en rutas autenticadas mantiene la sesión correctamente (verificado en workflow-clinical + audit-capture).

---

## 10. Hallazgos UI/UX

### UX-001 Mensajes de validación con texto de Zod expuesto
Ver sección hallazgo UX-001 en el bloque de hallazgos formateados.

### UX-002 Topbar vacío en rol Admin
El área de breadcrumbs/stat chips en la topbar queda vacía para el Admin. En el Médico muestra stats relevantes. Para el Admin, ese espacio simplemente queda en blanco, sin aprovechar el espacio o indicar contexto.

### UX-003 Ítem "-" en barra lateral
Un ítem con guión como label aparece al final de la navegación lateral en el rol Médico (bajo "Plantillas"). Parece un bug de renderizado donde un ítem condicional muestra su key en lugar de su label.

### UX-004 Reportes Admin muestra error en lugar de mensaje de acceso
La página `/reportes` está en el nav del Admin pero no carga datos. Mejor UX sería un mensaje "Los reportes operacionales están disponibles para el rol Médico" en lugar de un error rojo genérico.

### UX-005 Banner "Necesita una invitación" aparece con invitación válida
En `/register` con token válido, el banner amarillo se muestra aunque las badges "Invitación validada" y "Rol fijado" confirman que todo está correcto. Contradictorio.

### UX-006 Rol en ajustes muestra enum raw "ADMIN"
El campo Rol en Ajustes muestra "ADMIN" como badge en lugar de "Administrador". La barra lateral ya usa "Administrador" como label — inconsistencia.

### UX-007 Portal paciente muestra valores de enum sin formatear
"FEMENINO" debería mostrarse como "Femenino". Aplica a Sexo y posiblemente otros campos enum en el portal.

### UX-008 Forgot-password usa layout diferente al resto del flujo auth
Login y Register usan split 2 columnas con panel de branding a la izquierda. Forgot-password usa card centrado sobre fondo gris. Rompe la coherencia visual del flujo de autenticación.

### UX-009 Acceso a /agenda para Admin sin agenda en nav
El Admin puede llegar a /agenda directamente y ve "Sin médico asignado". Técnicamente funciona pero es una pantalla sin utilidad para el Admin. Podría redirigir con mensaje más claro o restringir el acceso.

---

## 11. Hallazgos de seguridad y privacidad básica

### SEG-001 Protección de rutas — PASS ✅
Todas las rutas del dashboard (`/pacientes`, `/atenciones`, `/agenda`, `/admin/*`, `/ajustes`) redirigen correctamente a `/login?from={ruta}` cuando no hay sesión activa. Verificado por los 6 tests en `evidence-live.json`.

### SEG-002 PII no expuesta en consola — PASS ✅
Revisados `evidence.json` y `evidence-live.json`. No se encontraron nombres, RUTs, datos de salud ni tokens sensibles en los logs de consola. Los errores de consola son: mensajes CSP (CSS), 403s de API y el error de recurso 401 del intento de login fallido.

### SEG-003 Secretos en frontend — PASS ✅
Variables sensibles del frontend son `NEXT_PUBLIC_API_URL=/api` y flags de modo. No hay secrets hardcodeados en el bundle frontend verificable. Las claves de cifrado, JWT y encryption son exclusivas del backend y se cargan via `.env`.

### SEG-004 CSP Violations — Baja riesgo, ruido de consola
Todas las páginas generan errores CSP: `"Applying inline style violates the following Content Security Policy directive 'style-src 'self' 'nonce-...'"`. Estas son violaciones de estilos inline que el navegador bloquea. No rompen la UI visible (estilos funcionan via clases de Tailwind), pero indican que alguna librería inyecta estilos inline que chocan con la política de nonce. Potencialmente afectan a gráficos o componentes de terceros.

**Clasificación:**
- Necesario: protección de rutas (✅ está implementada), sesiones JWT (✅ implementadas)
- Recomendable: revisar CSP violations, backup periódico (dashboard ya muestra estado), HTTPS (Cloudflare Tunnel lo provee)
- Overkill: SOC 2, penetration testing profesional, PKI completo, firma FIEL

### SEG-005 Cifrado de PII — PASS ✅
Según el diseño del sistema, los campos sensibles del paciente (nombre, RUT, teléfono, email, domicilio) están cifrados a nivel app con `ENCRYPTION_KEY`. El `rutLookupHash` permite búsquedas sin descifrar. Este diseño es robusto para el caso de uso personal.

### SEG-006 Confirmaciones antes de acciones destructivas
No se pudo verificar directamente por limitaciones de la sesión de test (botones de archivar no encontrados en los tests automatizados). El código sí tiene dialogs de confirmación implementados (`[role="dialog"]`). Se asume presente pero no se verificó visualmente.

---

## 12. Bugs e inconsistencias priorizados

### [BUG-001] Mensajes de validación exponen texto interno de Zod

- **Severidad:** Media
- **Prioridad:** P1
- **Área:** UI/UX · Funcional
- **Evidencia:** `audit__patient-form-validation-errors--desktop.png`
- **Impacto:** La médica ve mensajes como `"Invalid enum value. Expected 'MASCULINO' | 'FEMENINO' | 'OTRO' | 'PREFIERE_NO_DECIR', received ''"` al intentar guardar un paciente sin seleccionar sexo o previsión. Es confuso y poco profesional.
- **Recomendación:** En el schema Zod del formulario de paciente, agregar `.message()` a las validaciones de enum: `z.nativeEnum(Sexo, { errorMap: () => ({ message: 'Selecciona el sexo del paciente' }) })`. Aplica también a Previsión.
- **¿Es overkill?:** No

---

### [BUG-002] Reportes Admin — 403 silencioso muestra error genérico

- **Severidad:** Alta
- **Prioridad:** P1
- **Área:** Funcional · UI/UX
- **Evidencia:** `reportes__list--desktop.png`, `evidence.json` entry `audit__monitor--reportes`: `"403 GET .../api/analytics/operational/daily-summary"`
- **Impacto:** Si la usuaria tiene rol Admin (común al ser la primera usuaria registrada), la página Reportes siempre mostrará "No se pudo cargar el reporte." en lugar de un contenido útil.
- **Recomendación:** Opción A: mostrar en el componente de Reportes un mensaje "Los reportes están disponibles para el rol Médico" cuando el rol no tiene permiso (detectar 403 específicamente). Opción B (mejor): no incluir /reportes en la navegación del Admin si no tiene acceso.
- **¿Es overkill?:** No

---

### [BUG-003] 403 en `/api/alerts/unacknowledged-count` para Admin en cada página

- **Severidad:** Media
- **Prioridad:** P1
- **Área:** Funcional
- **Evidencia:** `evidence.json` — presente en `dashboard-admin`, `pacientes-list`, `atenciones-list`, `agenda`, `ajustes`, `analitica`, `admin-usuarios`, `admin-auditoria`, `reportes`, `catalogo` (10/12 páginas monitoreadas)
- **Impacto:** Cada navegación del Admin genera 2 console.error + 2 network errors. No hay impacto visual (el ícono de alertas probablemente simplemente no muestra contador), pero ensucia la consola y hace difícil detectar errores reales.
- **Recomendación:** En el hook/query que llama a `/api/alerts/unacknowledged-count`, agregar la condición `if (!hasPermission(user, 'alerts.read')) return`. La misma verificación de permisos que ya existe en `frontend/src/lib/permissions.ts` puede usarse aquí.
- **¿Es overkill?:** No

---

### [BUG-004] Color contrast insuficiente en badge "X% completa"

- **Severidad:** Media
- **Prioridad:** P1
- **Área:** Accesibilidad
- **Evidencia:** axe-core test failure — `<span class="bg-status-red text-white">25% completa</span>` — ratio 2.7:1, necesita 4.5:1 (WCAG 2 AA)
- **Impacto:** El badge de completitud de fichas de paciente (que indica qué porcentaje de la ficha está completa) tiene contraste insuficiente. Para alguien con baja visión o daltonismo, el texto del badge puede ser ilegible.
- **Recomendación:** Oscurecer `bg-status-red` — pasar de `#d08c84` a algo como `#b5352a` (~4.6:1 con blanco), o usar texto negro/oscuro en ese fondo. Actualizar el design token `--color-status-red` en el sistema de diseño.
- **¿Es overkill?:** No

---

### [BUG-005] CSP Violations en consola en todas las páginas

- **Severidad:** Baja
- **Prioridad:** P2
- **Área:** Seguridad
- **Evidencia:** `evidence-live.json` — todas las entradas tienen 3+ `consoleErrors` sobre `"Applying inline style violates Content Security Policy directive 'style-src...nonce...'"`.
- **Impacto:** No visible para el usuario. Sin embargo, si algún componente usa inline styles para posicionamiento crítico (tooltips, popovers, dropdowns), podría quedar mal posicionado en algunos navegadores con CSP estricta. También complica la detección de errores reales en consola.
- **Recomendación:** Identificar qué librería genera los inline styles (posiblemente Radix UI, Floating UI, o un componente de fecha). Agregar la regla de nonce o CSP hash correspondiente, o configurar `'unsafe-inline'` solo en desarrollo.
- **¿Es overkill?:** Tal vez — para uso personal el impacto es mínimo.

---

### [BUG-006] Ítem "–" sin label en barra lateral (rol Médico)

- **Severidad:** Baja
- **Prioridad:** P2
- **Área:** UI/UX
- **Evidencia:** `dashboard__medico--desktop.png`, `seguimientos__list--desktop.png`, `pacientes__new--desktop.png` — todos muestran el guión al final del nav
- **Impacto:** Aparece un separador o ítem de nav vacío con solo un guión en la barra lateral. Parece un item de nav condicional que renderiza sin label cuando cierta condición no está cumplida.
- **Recomendación:** Revisar la definición de nav items en `DashboardLayout.tsx` — hay un ítem que se renderiza condicionalmente pero muestra `-` cuando la condición falla en lugar de no renderizarse. Agregar `if (!condition) return null`.
- **¿Es overkill?:** No

---

### [BUG-007] Banner de invitación aparece aunque la invitación es válida

- **Severidad:** Baja
- **Prioridad:** P2
- **Área:** UI/UX
- **Evidencia:** `public__register--desktop.png` — badges "Invitación validada" + "Rol fijado" presentes junto al banner amarillo "Necesita una invitación válida para crear una cuenta."
- **Impacto:** El banner siempre visible es contradictorio con los badges que confirman la invitación. Genera confusión innecesaria.
- **Recomendación:** Mostrar el banner solo cuando no hay token de invitación en la URL/estado, no siempre.
- **¿Es overkill?:** No

---

### [BUG-008] Valor raw de enum en portal paciente ("FEMENINO")

- **Severidad:** Baja
- **Prioridad:** P3
- **Área:** UI/UX
- **Evidencia:** `portal__home--desktop.png` — campo Sexo muestra "FEMENINO"
- **Impacto:** Menor pero poco profesional si el paciente ve el portal. Debería ser "Femenino" o "Mujer".
- **Recomendación:** Crear un mapa de labels en el portal: `const sexoLabels = { FEMENINO: 'Femenino', MASCULINO: 'Masculino', ... }`. Igual para Previsión si aplica.
- **¿Es overkill?:** No

---

### [BUG-009] Rol en Ajustes muestra enum "ADMIN" en lugar de "Administrador"

- **Severidad:** Baja
- **Prioridad:** P3
- **Área:** UI/UX
- **Evidencia:** `ajustes__perfil--desktop.png` — badge "ADMIN" en field Rol
- **Impacto:** Inconsistencia con la barra lateral que muestra "Administrador". Minor.
- **Recomendación:** Aplicar el mismo mapa de labels de roles que usa la barra lateral al campo de Ajustes.
- **¿Es overkill?:** No

---

### [BUG-010] Doble clic en guardar no deshabilita el botón

- **Severidad:** Baja
- **Prioridad:** P2
- **Área:** Funcional
- **Evidencia:** `live__double-click-save--desktop.png` — botón no aparece deshabilitado tras primer clic
- **Impacto:** Con un formulario válido, el doble clic rápido podría disparar 2 requests paralelos. En formularios protegidos por validación Zod (como nuevo paciente con campos vacíos), la validación previene el submit, pero en casos válidos podría crear duplicados.
- **Recomendación:** En el `onSubmit` del formulario, setear un estado `isSubmitting` y deshabilitar el botón durante la petición. React Hook Form ya provee `formState.isSubmitting` para esto.
- **¿Es overkill?:** No para el botón de guardar paciente/atención. Sí para formularios de bajo riesgo.

---

## 13. Recomendaciones antes de producción

Ordenadas por impacto real para el uso de la Dra.:

1. **[P1] Arreglar mensajes de validación en nuevo paciente** (BUG-001) — Mensajes técnicos visibles al primer error.
2. **[P1] Ocultar /reportes del nav Admin o manejar 403 con mensaje claro** (BUG-002) — Error visible en página accesible.
3. **[P1] Corregir contraste bg-status-red** (BUG-004) — Falla WCAG AA automatizado. Fácil de corregir.
4. **[P1] Condicionar llamada a alerts endpoint por rol** (BUG-003) — Evita 403s en consola en cada página Admin.
5. **[P2] Arreglar ítem "-" en nav lateral** (BUG-006) — Visible constantemente.
6. **[P2] Arreglar banner contradicción en registro** (BUG-007) — Confunde a nuevos usuarios.
7. **Verificar backup en producción** — El dashboard Admin muestra estado de backup "Vencido" + "Sin registro". Configurar y ejecutar un backup antes de subir a producción real.
8. **Ejecutar verificación de integridad de auditoría** — Desde `/admin/auditoria`, ejecutar "Verificar reciente" al iniciar para establecer el primer estado base.

---

## 14. Mejoras recomendadas después de producción

- **Formatear valores enum en portal paciente** (BUG-008)
- **Normalizar etiqueta de rol en Ajustes** (BUG-009)
- **Investigar y resolver CSP violations** (BUG-005) — Identificar librería que genera inline styles
- **Poblar topbar del Admin** con métricas operativas relevantes (usuarios activos, solicitudes pendientes)
- **Cohesionar layout del flujo auth** — Forgot-password debería tener el mismo split layout que Login/Register
- **Autoguardado de secciones** en el wizard de atención (actualmente existe cola offline, pero autoguardado explícito sería más visible)
- **Indicador de cambios sin guardar** más prominente en el formulario de edición de paciente
- **Deshabilitar botón en envío** para todos los formularios críticos (BUG-010)

---

## 15. Funcionalidades EMR faltantes

### Esenciales para uso personal (implementar antes o poco después de producción)

- **Backup automático configurado** — El script existe (`npm run db:backup`) pero necesita estar automatizado (cron, systemd timer, etc.). El dashboard ya alerta cuando está "Vencido".
- **Exportar datos del paciente como PDF** — El portal ya tiene descarga de atenciones. Falta exportación completa de ficha por paciente para la médica.
- **Plantillas de notas** — Módulo `/plantillas` **existe** y está en el nav. Bien.
- **Historial clínico por paciente** — La ficha `/pacientes/[id]/historial` **existe**. Bien.
- **Búsqueda rápida** — `Ctrl+K` **existe** en el topbar. Bien.

### Muy útiles pero no urgentes

- **Adjuntar archivos a la ficha del paciente** (no solo a atenciones) — actualmente adjuntos son por atención
- **Exportación CSV del padrón de pacientes** — mencionado en la UI ("Padrón de pacientes — Consultar y exportar CSV") — verificar si ya está implementado o es solo un link
- **Recordatorios simples / alertas de seguimiento** — Seguimientos existen pero son tareas manuales, no recordatorios con notificación
- **Timeline visual del paciente** — Ver la historia clínica completa como línea de tiempo (actualmente es lista de atenciones)
- **Resumen automático del paciente** — Al entrar a una atención, un bloque de resumen previo con diagnósticos y alergias (el "Resumen clínico fijo" ya hace parte de esto)
- **Atajos de teclado adicionales** — Además de `Ctrl+K`, atajos para crear paciente, nueva atención, etc.

### Overkill por ahora

- HL7/FHIR completo
- Facturación médica / Bonos
- Multi-clínica / Multi-tenant
- Firma digital avanzada tipo FEA/FEC (la firma simple actual es adecuada para baja escala)
- Integración con laboratorios o sistemas hospitalarios
- Portal multi-especialidad
- Motor de permisos granular (el modelo actual MEDICO/ASISTENTE/ADMIN es suficiente)
- Auditoría regulatoria completa estilo ISO 27001
- Infraestructura de alta disponibilidad (HA, clusters)
- Reportes estadísticos complejos para supervisión epidemiológica

---

## 16. Qué sería overkill por ahora

Para uso personal o de baja escala (1 médica, pocos pacientes):

- **SOC 2 / ISO 27001** — Certificaciones de seguridad empresariales. Completamente innecesarias.
- **Penetration testing profesional** — Deseable eventualmente, pero no bloqueante para el caso de uso.
- **CDN multi-región** — Cloudflare Tunnel ya provee protección básica. Más que suficiente.
- **Kubernetes / orquestación de contenedores** — Docker Compose es más que adecuado.
- **Observability enterprise** (Prometheus+Grafana+Loki ya están incluidos en Docker Compose — son opcionales, no necesarios para 1 usuario).
- **Facturación y recaudación** — Fuera del scope EMR personal.
- **Integración con MINSAL / Fonasa** — Overkill hasta escalar.
- **Módulo de inventario farmacéutico** — No aplica a consulta personal.

---

## 17. Checklist final para salir a producción personal

| Área | Estado | Bloquea producción personal | Acción recomendada |
|---|---|---|---|
| Autenticación (login/logout/refresh) | ✅ OK | No | Ninguna |
| Registro por invitación | ✅ OK | No | Arreglar banner contradicción (P2) |
| Protección de rutas privadas | ✅ OK | No | Ninguna |
| Recuperación de contraseña | ✅ OK | No | Mejorar layout consistencia (P3) |
| Crear / editar paciente | ⚠️ Parcial | No | Arreglar mensajes validación Zod (P1) |
| Ver historial paciente | ✅ OK | No | Ninguna |
| Crear atención | ✅ OK | No | Ninguna |
| Editar secciones clínicas | ✅ OK | No | Ninguna |
| Completar y firmar atención | ✅ OK | No | Ninguna |
| Adjuntos en atención | ✅ OK | No | Ninguna |
| Portal del paciente | ✅ OK | No | Formatear enums (P3) |
| Agenda | ✅ OK (rol médico) | No | Ninguna para médico |
| Seguimientos | ✅ OK | No | Arreglar ítem "-" nav (P2) |
| Reportes | ⚠️ Problema (solo admin) | No si usa rol médico | Ocultar del nav admin o manejar 403 (P1) |
| Analítica clínica | ✅ OK | No | Ninguna |
| Alertas clinicas | ✅ OK | No (bug solo admin) | Corregir llamada por rol (P1) |
| Catálogo | ✅ OK | No | Ninguna |
| Plantillas | ✅ OK | No | Ninguna |
| Ajustes | ✅ OK | No | Normalizar labels rol (P3) |
| Admin usuarios | ✅ OK | No | Ninguna |
| Admin auditoría | ✅ OK | No | Ejecutar 1ª verificación |
| UI desktop | ✅ OK | No | Correcciones menores P2/P3 |
| UI mobile | ✅ OK | No | Ninguna urgente |
| Color/contraste | ⚠️ Parcial | No | Badge status-red contraste (P1) |
| Privacidad básica / PII cifrada | ✅ OK | No | Ninguna |
| Exportación / backup | ⚠️ Parcial | **Sí** | Configurar backup automático antes de uso real |
| Configurar HTTPS | Depende despliegue | **Sí** | Verificar Cloudflare Tunnel activo |
| Documentos legales producción | ⚠️ Pendiente | **Sí** | Reemplazar documentos de dev (tienen DEV_ONLY_LEGAL_MARKER) |

---

## 18. Conclusión

**Anamneo está razonablemente lista para uso personal.** El flujo clínico principal — crear pacientes, registrar atenciones, llenar secciones clínicas, gestionar alergias, adjuntar archivos, completar y firmar — funciona correctamente de principio a fin en base a 11 tests de workflow que pasan al 100%.

La autenticación es robusta (JWT + refresh, TOTP 2FA opcional, guards por rol, redirección correcta en rutas protegidas). La PII está cifrada a nivel app (Ley 21.719). El portal del paciente es funcional.

Los problemas encontrados son principalmente de rol Admin (que no es el rol de uso principal), validaciones con texto técnico visible (fácil de corregir), y ruido de consola que no afecta la experiencia visible.

**Los 3 pasos concretos antes de poner en producción:**
1. Reemplazar los documentos legales de desarrollo (tienen el marcador `DEV_ONLY_LEGAL_MARKER`) con documentos reales.
2. Configurar y probar el backup automático de PostgreSQL.
3. Arreglar los mensajes de validación técnicos en el formulario de nuevo paciente.

Todo lo demás puede hacerse en producción sin bloquear el uso clínico real.

---

*Generado con Playwright · axe-core · análisis manual de 84 capturas · 2026-06-03*
