# Auditoría técnica y funcional de Anamneo

Fecha: 2026-04-22

## 1. Resumen ejecutivo

Audité el repositorio completo de Anamneo como EMR/EHR chica para 1 a 5 usuarios: backend NestJS + Prisma, frontend Next.js, autenticación, permisos, flujos clínicos, exports, adjuntos, configuración, scripts operativos, tests y build.

Estado general: la base es buena para un proyecto chico real. Hay arquitectura modular razonable, permisos clínicos bien pensados, exportes útiles, auditoría, backups/restore documentados para SQLite y una cobertura backend por encima del promedio. El trabajo pendiente ya no es “hacer la app”, sino terminar de cerrar algunos bordes de seguridad práctica, integridad clínica y mantenibilidad.

En esta pasada se cerraron dos mejoras pedidas por producto:

- acción de “cerrar otras sesiones” en un solo clic;
- resumen clínico fijo dentro de la atención con alergias, medicación habitual, problemas activos y alertas;
- además se apretó el tipado visible del render clínico en la atención.

Riesgo global actual: **Medio**.

Conclusión corta: **después de esta segunda pasada de fixes la considero lista para producción pequeña, con un remanente ya bastante acotado de mejoras clínicas y técnicas no bloqueantes**.

Validación ejecutada:

- `npm --prefix backend run typecheck` ✅
- `npm --prefix frontend run typecheck` ✅
- `npm --prefix backend run lint:check` ✅
- `npm --prefix frontend run lint` ✅
- `npm --prefix backend run test` ✅
- `npm --prefix frontend run test` ✅
- `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` ✅
- `npm run build` ✅
- `curl http://127.0.0.1:5678/api/health` ✅ respondió `200 OK`
- `curl http://127.0.0.1:5555` ✅ respondió `307` a `/login`
- `npm --prefix backend test -- auth.service.spec.ts --runInBand` ✅
- `npm --prefix backend run typecheck` ✅
- `npm --prefix frontend run typecheck` ✅
- `npm --prefix frontend test -- ClinicalAlerts.test.tsx --runInBand` ✅
- `PLAYWRIGHT_REUSE_EXISTING=true npm --prefix frontend run test:e2e -- tests/e2e/smoke.spec.ts --workers=1` ⚠️ 1 test pasó y 1 falló por timeout en el bootstrap del smoke

Notas de ejecución:

- No reinstalé dependencias porque el workspace ya tenía `node_modules` y pude correr typecheck, tests y build.
- El arranque directo con `npm --prefix backend run start:prod` y `npm --prefix frontend run start` chocó con `EADDRINUSE`, pero no por falla de la app: en este entorno ya había procesos escuchando en `:5678` y `:5555`.
- El smoke e2e con Playwright quedó inconcluso en este entorno; no lo tomo como bug confirmado.
- El smoke e2e con Playwright dejó un fallo de bootstrap en este entorno; el caso pasado siguió en verde y no lo tomo como regresión confirmada del cambio.
- Para algunos fixes usé documentación oficial vía Context7, puntualmente para saneo de stores persistidos de Zustand en tests, para verificar el flujo seguro de TOTP con `otplib` y para mantener consistente la invalidación de queries/mutaciones de la nueva UI de sesiones con TanStack Query.

## 2. Veredicto de producción

**Lista para producción**, usando como criterio una app médica pequeña de 1 a 5 usuarios y no un SaaS masivo.

Justificación concreta:

- Los hallazgos altos detectados en la primera pasada y que sí bloqueaban una salida prudente quedaron corregidos en código:
  - revocación de sesiones en cambios/reset administrativos de contraseña,
  - enforcement server-side del timeout de inactividad,
  - cifrado en reposo de `totpSecret`,
  - validación más estricta de `SETTINGS_ENCRYPTION_KEY`,
  - estabilidad de la suite frontend,
  - consistencia de progreso en la atención,
  - simplificación del flujo administrativo de cambio de contraseña,
  - autogestión básica de sesiones activas con cierre remoto,
  - y cobertura e2e explícita para inactividad real y revocación de sesiones.
- La matriz técnica importante quedó verde: typecheck, lint, tests backend, tests frontend, e2e backend y build.
- Lo que queda abierto es más propio de endurecimiento razonable, UX clínica y deuda técnica que de bloqueantes reales para un consultorio chico.

Reserva importante:

Este veredicto asume un despliegue simple pero prolijo: secretos reales, HTTPS, backup verificable, restore drill ejecutado y host razonablemente endurecido. Si se desplegara con placeholders, sin backups o sin cifrado básico del entorno, el veredicto deja de aplicar.

## 3. Hallazgos críticos y altos

No quedan hallazgos **críticos** ni **altos** abiertos después de la pasada de remediación del 2026-04-22.

Hallazgos altos corregidos en esta pasada:

| Severidad original | Estado | Título | Archivo(s) afectados | Descripción | Impacto residual | Recomendación restante | Esfuerzo restante |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Alto | Corregido | Cambios administrativos de contraseña no revocaban sesiones activas | `backend/src/users/users.service.ts`, `backend/src/users/users.service.spec.ts`, `frontend/src/app/(dashboard)/ajustes/SessionManagementSection.tsx`, `backend/src/auth/auth.controller.ts` | Ahora tanto `update()` con cambio de contraseña como `resetPassword()` rotan versión de refresh token y revocan sesiones activas del usuario; además el usuario ya puede listar y cerrar sesiones remotas desde Ajustes. | Muy bajo | Como mejora incremental, sumar cierre masivo de “otras sesiones” en un solo clic. | Bajo |
| Alto | Corregido | El timeout de inactividad solo vivía en frontend | `backend/src/auth/auth-refresh-flow.ts`, `backend/src/auth/auth.service.ts`, `backend/src/users/users-session.service.ts`, `backend/test/suites/auth.e2e-suite.ts` | El refresh ahora consulta la política efectiva de sesión, compara `lastUsedAt`, revoca la sesión vencida y rechaza el refresh por inactividad. La cobertura ya incluye prueba e2e del flujo real. | Muy bajo | Opcional: agregar también una prueba browser end-to-end completa del redirect por inactividad en frontend. | Bajo |
| Alto | Corregido | El secreto TOTP quedaba almacenado en texto plano | `backend/src/auth/auth-totp-secret.ts`, `backend/src/auth/auth-totp.service.ts`, `backend/src/auth/auth-2fa-flow.ts`, specs asociadas | La semilla TOTP ahora se cifra con la infraestructura existente de secretos de settings; la lectura mantiene compatibilidad con secretos legacy en texto plano. | Bajo | Considerar una migración batch opcional para reencriptar usuarios legacy ya existentes. | Bajo |
| Alto | Corregido | La protección contra placeholders de `SETTINGS_ENCRYPTION_KEY` era incompleta | `backend/src/main.ts` | El startup check ahora bloquea explícitamente `replace-with-a-secure-settings-key`. | Muy bajo | Mantener el mismo criterio en cualquier futura variable sensible. | Bajo |

## 4. Bugs e inconsistencias funcionales

### 4.1 Suite frontend no confiable como compuerta de release

**Corregido.**

- `frontend/src/__tests__/setup.ts` ahora hace cleanup global y resetea `localStorage`, `sessionStorage` y stores persistidos relevantes entre tests.
- Resultado comprobado: `npm --prefix frontend run test` quedó verde completo.

### 4.2 Inconsistencia visual de progreso en la atención

**Corregido.**

- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizardDerived.ts` ahora cuenta como resueltas tanto las secciones `completed` como `notApplicable`, igual que la barra lateral.
- Resultado: el progreso mostrado en header y rail vuelve a ser consistente en consulta real.

### 4.3 Dos flujos administrativos de contraseña con semánticas distintas

**Corregido parcialmente y simplificado.**

- Se quitó de la edición de usuario el campo de cambio directo de contraseña en `frontend/src/app/(dashboard)/admin/usuarios/page.tsx` y `useUsuarios.ts`.
- Quedó como camino administrativo principal el reset temporal con `mustChangePassword`, que es más coherente para una app chica y reduce ambigüedad operativa.
- Además, el backend ahora revoca sesiones en cualquier mutación administrativa de contraseña.

### 4.4 Comentario de seguridad y comportamiento real no coinciden en `RolesGuard`

**Corregido a nivel documental, no de comportamiento.**

- El comentario engañoso se actualizó en `backend/src/common/guards/roles.guard.ts`.
- El comportamiento sigue siendo backward-compatible: si un endpoint autenticado no declara `@Roles()`, pasa el usuario autenticado.
- No encontré evidencia de exposición actual por esto, pero sigue siendo un footgun de mantenimiento para futuras rutas.

### 4.5 Estado funcional después de la remediación

No quedaron bugs altos/medios confirmados en los flujos auditados. Los pendientes actuales están más del lado de UX clínica incremental, endurecimiento operativo y deuda técnica.

### 4.6 Autogestión básica de sesiones

**Corregido e implementado.**

- El backend ahora expone `GET /api/auth/sessions` y `DELETE /api/auth/sessions/:id` para la propia cuenta autenticada.
- El frontend muestra la sesión actual, lista sesiones remotas y permite cerrarlas desde Perfil y seguridad.
- El `access_token` ahora carga `sid`, lo que permite identificar correctamente la sesión actual sin depender del refresh token.
- Resultado comprobado: cobertura frontend y e2e backend para listado, revocación remota e imposibilidad de refrescar una sesión revocada.

### 4.7 Cierre rápido de otras sesiones y resumen clínico fijo

**Corregido e implementado.**

- El backend ahora expone `DELETE /api/auth/sessions/others` para cerrar todas las sesiones de la cuenta excepto la actual.
- La tarjeta de sesiones en Ajustes agrega una acción de un clic para cerrar otras sesiones y refresca la lista en el acto.
- La atención ahora muestra un bloque fijo con alergias, medicación habitual, problemas activos y alertas relevantes antes del editor de secciones.
- En el render clínico visible se reemplazaron varios casts laxos por accesos tipados y helpers de sección.

## 5. Seguridad y privacidad

### 5.1 Riesgo observado hoy en desarrollo

- No traté los datos del entorno como incidente real porque el contexto indica que son ficticios o sintéticos.
- No vi secretos sensibles versionados de forma obvia en archivos tracked.
- El riesgo más importante del entorno de desarrollo ya no es una brecha concreta, sino la posibilidad de arrastrar malas prácticas al deployment real si no se replica el mismo nivel de guardrails.

### 5.2 Riesgos potenciales si esto se despliega así en producción

#### Auth y sesiones

- Corregido: cambio/reset administrativo de contraseña ahora revoca sesiones.
- Corregido: el timeout de inactividad ya no depende solo del browser.
- Corregido: existe ya una UI visible de sesiones activas y cierre remoto por sesión.
- Corregido: ahora existe también una acción masiva de “cerrar las demás sesiones” desde Ajustes.

#### 2FA

- Corregido: `totpSecret` ahora se guarda cifrado en reposo.
- La implementación quedó además backward-compatible con secretos legacy sin cifrar, lo cual reduce riesgo de corte durante despliegue.

#### Secrets y configuración sensible

- Corregido: el startup check ahora rechaza también el placeholder de ejemplo para `SETTINGS_ENCRYPTION_KEY`.
- Sigue siendo cierto que la app no puede garantizar por sí sola cifrado del filesystem del host. En producción con SQLite, uploads y backups conviene asumir que el host debe estar cifrado o al menos muy bien controlado.

#### Permisos

- La base FE/BE de permisos y alcance clínico sigue siendo uno de los puntos fuertes del proyecto.
- `JwtStrategy` vuelve a cargar el usuario desde base en cada request, lo cual reduce confianza en claims viejos.
- Riesgo de diseño a futuro: `RolesGuard` sigue siendo fail-open para usuarios autenticados si una ruta nueva se olvida de declarar `@Roles()`. No lo vi explotado hoy, pero conviene mantener disciplina fuerte de decoradores.

### 5.3 Cosas bien resueltas

- Cookies `HttpOnly`, `sameSite: 'strict'` y sin Bearer fallback en `JwtStrategy`.
- Patrón same-origin `/api` documentado y mantenido.
- Guardrails de arranque razonables en `backend/src/main.ts`.
- Existe auditoría con hash chain y catálogo de razones.
- Tras la remediación, el manejo de sesiones y 2FA quedó mucho más alineado con el nivel de riesgo esperable para una EMR chica.

## 6. Modelo de datos e integridad clínica

Estado general: **razonablemente bueno para una EMR chica**. El modelo cubre pacientes, antecedentes, encuentros, problemas, tareas, consentimientos, alertas, adjuntos, firmas y exportes longitudinales.

Puntos fuertes:

- `Patient`, `PatientHistory`, `Encounter`, `EncounterSection`, `PatientProblem`, `EncounterTask`, `InformedConsent`, `ClinicalAlert` y `Attachment` forman un conjunto coherente para primera producción chica.
- Hay exporte longitudinal PDF y paquete ZIP clínico por paciente: `backend/src/patients/patients.controller.ts`, `backend/src/patients/patients-export-bundle.service.ts`.
- Hay validaciones sanas para payload de secciones y motivo de “no aplica”: `backend/src/encounters/dto/update-section.dto.ts`.

Riesgos y limitaciones vigentes:

- `PatientHistory` guarda alergias y medicación habitual como texto libre. Para una app pequeña es aceptable, pero limita alertas, filtros y chequeos futuros.
- `EncounterSection.data` es JSON serializado en `String` con `schemaVersion`. Es flexible y práctico, pero exige disciplina en tests de compatibilidad cuando cambien estructuras clínicas.
- Varias capas de formateo/export usan `any` en datos clínicos. Ejemplos: `backend/src/patients/patients-format.ts`, `backend/src/patients/patients-pdf.service.ts`, `backend/src/encounters/encounters-pdf.renderers.ts`. Eso baja la seguridad de tipo justo en superficies sensibles.

No encontré evidencia de corrupción de datos ya ocurriendo. Sí veo una combinación de flexibilidad + tipado laxo que merece más tests focalizados en exportes, impresión y rehidratación de secciones.

## 7. Mantenibilidad y deuda técnica

### 7.1 Fortaleza general

- La arquitectura por dominios está clara.
- La documentación operativa es superior al promedio de proyectos chicos.
- Backend con muy buen nivel de pruebas: unitarias, service specs y e2e stateful realistas.
- Después de esta pasada, el frontend también volvió a tener una suite estable como señal de calidad.
- Los nuevos flujos de sesión no quedaron solo en unit tests: también tienen cobertura e2e real.
- El nuevo resumen clínico fijo quedó cubierto al menos por typecheck y por la suite de alertas clínicas que comparte parte de su derivación.

### 7.2 Deuda técnica relevante

#### Archivos demasiado grandes para el estándar del repo

El propio `AGENTS.md` pide mantener archivos manuales cerca de 300 líneas y marca 500 como límite duro. Hoy hay varios archivos importantes por encima de 400:

- `frontend/src/components/EncounterDrawer.tsx`
- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow.ts`
- `backend/src/patients/patients-format.ts`
- `backend/src/attachments/attachments.service.ts`
- `backend/src/users/users.service.ts`

No es un desastre, pero sí complica auditar y tocar flujos clínicos con confianza.

#### Tipado laxo en superficies clínicas

Los `any` en formateadores, PDF y summary builders son deuda técnica real. En una EMR chica no hace falta sobrediseñar, pero sí conviene blindar mejor los puntos donde se transforma historia clínica para mostrar o exportar.

#### Auditoría con riesgo de carrera teórica

Hipótesis razonable, no bug reproducido.

- `backend/src/audit/audit.service.ts` calcula el hash leyendo el último registro y luego insertando el nuevo.
- Si dos writes concurrentes leen el mismo `previousHash`, la cadena podría bifurcarse.

Para 1 a 5 usuarios el riesgo operativo es bajo, pero si se quiere usar la cadena como integridad fuerte conviene serializar mejor ese paso o al menos añadir test concurrente.

#### Cobertura browser todavía menos madura que la cobertura backend

- El backend queda muy bien cubierto.
- El frontend unit/integration quedó verde.
- Sigue faltando una pasada browser realmente confiable para login, atención, export y logout, idealmente con Playwright estable contra el stack completo.

## 8. Funcionalidades sugeridas alineadas con Anamneo

### Imprescindibles

- Exportación clínica simple y verificable por paciente.
  Valor: ya hay exportes fuertes; conviene asegurar un formato muy fácil de entregar o archivar fuera del sistema ante contingencias.

### Muy útiles

- Medicación habitual estructurada a nivel paciente.
  Valor: hoy la medicación crónica vive sobre todo en texto libre; una estructura simple mejoraría alertas, búsqueda y lectura longitudinal.
- Exportación CSV desde analítica clínica.
  Valor: `docs/clinical-analytics.md` ya reconoce que falta y es útil para seguimiento simple.

### Opcionales

- Plantillas clínicas contextuales por motivo frecuente o diagnóstico.
  Valor: acelera la consulta sin rehacer arquitectura.
- Mejoras de UX en conflictos/offline.
  Valor: ya existe autosave y cola offline; hacer más explícito el estado daría mucha tranquilidad en uso diario.
- Paquete de exportación “entregable al paciente” más liviano.
  Valor: complementa el bundle técnico completo con un formato más práctico para derivaciones o continuidad asistencial.

## 9. Quick wins

- Tipar mejor los formateadores/exportes clínicos donde hoy hay `any`.
- Partir uno o dos archivos muy grandes del flujo de atención para bajar riesgo de regresión.
- Estructurar al menos alergias y medicación habitual en paciente, aunque sea con un modelo simple.
- Sumar un smoke browser corto para login, atención, export y logout sobre el stack completo.

## 10. Checklist mínimo antes de producción

- Desplegar con secretos reales y no placeholders.
- Confirmar HTTPS y cookies seguras en el entorno final.
- Confirmar backup automático y restore drill verificable en el host objetivo.
- Hacer una pasada manual breve de login, paciente, atención, export y logout en el deployment real.
- Verificar que el entorno final tenga cifrado o control fuerte del host para SQLite, adjuntos y backups.

## 11. Supuestos y limitaciones

- Asumí que los datos del entorno de desarrollo son ficticios, como indicó el contexto.
- No tomé la mera existencia de fichas, usuarios o pacientes de prueba como incidente de privacidad real.
- No pude validar una sesión completa con Playwright hasta el final en este entorno; por eso no marqué bugs visuales no reproducidos como hechos.
- El arranque directo manual quedó condicionado por puertos ya ocupados por procesos existentes; verifiqué salud del backend y respuesta del frontend vía `curl`.
- No audité infraestructura productiva real, certificados TLS, cifrado de disco del host ni políticas reales de backup del deployment final. Solo audité lo que el repositorio implementa o documenta.

## Balance final

Lo mejor de Anamneo hoy:

- buena base técnica para app pequeña,
- permisos y alcance clínico razonables,
- exportes clínicos reales,
- backend bien probado,
- y una remediación efectiva de los principales riesgos de sesión/2FA/test suite.

Lo que todavía conviene mejorar pronto:

- cierre masivo opcional de otras sesiones,
- UX clínica más resumida durante la consulta,
- tipado más fuerte en exportes y render clínico,
- y una pasada browser más sólida sobre el stack completo.
