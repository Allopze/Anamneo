# Anamneo: brief autosuficiente para construir la landing page

Este documento debe ser suficiente para construir una landing page de Anamneo en otro repositorio sin consultar otros `.md` ni el codigo de la app. Resume producto, narrativa, claims permitidos, limites, estructura de pagina, sistema visual y referencias de UI.

## 1. Objetivo de la landing

La landing debe presentar Anamneo como una ficha clinica moderna para consultas medicas en Chile: sobria, confiable, rapida de operar y pensada para continuidad clinica. No debe parecer una landing SaaS generica, una plataforma hospitalaria enterprise, ni una app de IA medica.

Promesa central:

> Anamneo ordena el trabajo clinico diario en una ficha longitudinal segura, rapida de completar y preparada para continuidad medica.

Tesis narrativa:

> La ficha clinica no deberia sentirse como papeleo digital. Deberia acompanar el razonamiento medico, proteger la continuidad del paciente y dejar trazabilidad sin friccion.

Posicionamiento:

> Anamneo es una ficha clinica moderna para consultas medicas que necesitan documentacion ordenada, flujos por rol, seguimiento y auditoria, sin cargar al equipo con un sistema corporativo enorme.

## 2. Que es Anamneo

Anamneo es una plataforma de gestion de fichas clinicas para consultas medicas en Chile. Su centro no es la agenda ni la facturacion: es la documentacion clinica completa, desde el alta del paciente hasta el cierre, firma, seguimiento, adjuntos, auditoria y exportacion de la historia.

Esta disenado para medicos y equipos pequenos o medianos que necesitan menos papel, menos planillas heredadas y mas trazabilidad sobre lo que ocurrio en cada atencion.

La landing debe vender principalmente:

- orden clinico,
- continuidad de informacion,
- atenciones por secciones,
- roles y permisos claros,
- seguimiento operativo,
- adjuntos, consentimientos y alertas en contexto,
- auditoria,
- seguridad practica,
- y una interfaz calida, seria y de baja friccion.

## 3. Producto actual que se puede comunicar

### Pacientes

- Registro de pacientes con validacion de RUT y soporte para pacientes exentos de RUT.
- Alta rapida o completa mediante modo de registro.
- Estado de completitud de ficha: incompleta, pendiente de verificacion o verificada.
- Validacion demografica con responsable y fecha.
- Deteccion de posibles duplicados y flujo de consolidacion.
- Archivado/restauracion mediante soft delete.
- Vista longitudinal con informacion personal, antecedentes, problemas, alertas, consentimientos, tareas, signos vitales, adjuntos y timeline de atenciones.
- Exportacion de historial PDF y paquete clinico cuando la ficha cumple requisitos de verificacion.

### Atenciones clinicas

- Creacion de atenciones asociadas a un paciente.
- Flujo por secciones clinicas con navegacion lateral, progreso y estados por seccion.
- Secciones principales: identificacion, motivo de consulta, anamnesis proxima, anamnesis remota, revision por sistemas, examen fisico, sospecha diagnostica, tratamiento, respuesta al tratamiento y observaciones.
- Guardado por seccion, manejo de cambios sin guardar y recuperacion de borradores locales.
- Deteccion de conflictos entre copia local y version de servidor.
- Bloqueos de salida clinica cuando falta verificar informacion critica del paciente.
- Cierre de atencion con checklist, nota de cierre y seguimiento vinculado.
- Firma de atencion mediante modal especifico.
- Reapertura, cancelacion, impresion/exportacion e historial de auditoria segun permisos y estado.

### Seguimientos y tareas

- Bandeja de seguimientos.
- Tareas clinicas u operativas con prioridad, estado y fecha limite.
- Alertas visibles para tareas vencidas, tareas que vencen hoy, tareas de la semana y tramites proximos.
- Acceso desde dashboard, paciente y flujo de atencion.

### Catalogos clinicos

- Catalogo global de afecciones.
- Catalogo local por medico o instancia.
- Sugerencias de afeccion basadas en texto de motivo de consulta.
- Registro de la decision tomada por el medico: automatica, manual o confirmada.
- Importacion CSV de afecciones por administrador, con preview server-side y consolidacion de duplicados.
- Catalogo global de medicamentos con nombre, principio activo, estado activo e importacion CSV.

### Analitica clinica

- Vista restringida a medicos no administradores.
- Analitica descriptiva y observacional, no causal.
- Cohortes por afeccion, sintoma o fuente diagnostica.
- Filtros por fecha, ventana de seguimiento y limite de resultados.
- Metricas sobre pacientes, atenciones, cobertura de tratamiento estructurado, reconsulta, ajustes terapeuticos, problemas resueltos, alertas posteriores, adherencia documentada y eventos adversos.
- Rankings de afecciones, sintomas, medicamentos, examenes y derivaciones, con mayor profundidad actual en medicamentos y sintomas.
- Drill-down hacia casos para cohortes, medicamentos y sintomas.
- Exportacion de resumen CSV y reporte Markdown.

### Consentimientos, alertas y adjuntos

- Consentimientos informados con otorgamiento, revocacion y motivo.
- Alertas clinicas con severidad, origen y acuse.
- Adjuntos vinculados a paciente, atencion u ordenes.
- Previsualizacion de adjuntos mediante modal.
- Acceso protegido por permisos y relacion efectiva con paciente/atencion.

### Administracion

- Primer registro con bootstrap de administrador.
- Luego, acceso por invitacion.
- Gestion de usuarios, roles y relaciones medico-asistente.
- Auditoria central filtrable.
- Ajustes de plataforma, politica de sesion, SMTP y configuracion operativa.
- Catalogos globales administrables.

### Seguridad y operacion

- Autenticacion por cookies `HttpOnly` con access token y refresh token.
- Sesiones persistidas por dispositivo y revocables.
- Soporte 2FA/TOTP y codigos de recuperacion.
- Proteccion contra intentos de login repetidos.
- Permisos compartidos entre frontend y backend para acciones sensibles de atenciones.
- Auditoria persistente con entidad, usuario, accion, resultado, diff, request id, timestamps y hashes de integridad.
- Settings sensibles cifrados a nivel aplicacion.
- En produccion, la app exige confirmacion de cifrado del filesystem para base de datos, uploads y backups.
- Operacion simple con Docker Compose, SQLite WAL, backups y restore drills documentados.

## 4. Usuarios y mensajes por rol

### Medico

Usuario principal. Crea y completa atenciones, valida fichas, registra decisiones clinicas, revisa historia longitudinal, firma encuentros, exporta informacion clinica y consulta analitica.

Mensaje:

> Un espacio de trabajo clinico para atender, documentar y cerrar con trazabilidad.

### Asistente

Apoya el flujo operativo: registro de pacientes, datos administrativos, preparacion de atenciones, adjuntos y seguimiento. Sus permisos son mas restringidos en contenido clinico sensible.

Mensaje:

> Recepcion puede avanzar trabajo sin invadir decisiones medicas.

### Administrador

Gestiona usuarios, catalogos, settings y auditoria. No debe presentarse como dueno clinico del dato.

Mensaje:

> Administracion clara, trazabilidad visible y menor riesgo de permisos ambiguos.

## 5. Claims permitidos y limites

### Se puede decir

- Ficha clinica longitudinal.
- Atenciones por secciones.
- Seguimiento, tareas, consentimientos, alertas y adjuntos en contexto.
- Roles y permisos claros para medico, asistente y administrador.
- Catalogos clinicos globales y locales.
- Sugerencias diagnosticas registradas basadas en catalogos.
- Analitica descriptiva exportable desde atenciones completadas o firmadas.
- Auditoria persistente para cambios sensibles.
- Sesiones revocables, 2FA y cookies `HttpOnly`.
- Operacion documentada con backups y restore drills.
- Disenado para consultas medicas en Chile.

### No prometer

- No vender "NLP clinico avanzado" ni "IA medica" como motor general.
- No decir "SQLite cifrado por la app": la app cifra settings sensibles; base, uploads y backups dependen del cifrado del filesystem.
- No prometer "admin-blind absoluto" como garantia legal cerrada. Usar "limites de acceso y trazabilidad".
- No describir la firma como "firma electronica avanzada" o "firma digital legal avanzada".
- No usar "gratis", "comienza ahora" o "abre tu cuenta" si el acceso real es bootstrap inicial e invitaciones.
- No usar logos de instituciones, testimonios ficticios ni metricas inventadas.
- No presentar la analitica como causal, predictiva o estadistica avanzada.
- No afirmar que todos los drill-downs analiticos cubren examenes y derivaciones; hoy la profundidad mas fuerte esta en cohortes, medicamentos y sintomas.

## 6. Tono editorial

- Profesional, calido y directo.
- Preciso, sin grandilocuencia.
- Hablar de orden, continuidad, seguridad practica y menos friccion.
- Evitar frases de SaaS generico como "potencia tu consulta con tecnologia de punta".
- Evitar tono hospital enterprise.
- Evitar medicalizar de mas con iconografia obvia o fotografias genericas.
- El producto debe sentirse serio, humano y cotidiano.

## 7. Headlines y copy base

### Headlines posibles

1. `Ficha clinica moderna para consultas que necesitan orden, continuidad y trazabilidad.`
2. `Documenta la atencion completa sin perder el hilo clinico.`
3. `Del primer registro al seguimiento: una ficha clinica que acompana el flujo real de consulta.`
4. `Menos papeleo. Mas continuidad clinica.`

### Headline recomendado para hero

`Ficha clinica moderna para consultas que necesitan orden, continuidad y trazabilidad.`

### Subheadline recomendado

`Anamneo reune pacientes, atenciones por secciones, seguimiento, adjuntos, catalogos y auditoria en una experiencia clinica calida y precisa, disenada para equipos medicos en Chile.`

### CTA recomendado

Como el acceso puede ser por invitacion, evitar "Empieza gratis". Usar:

- `Solicitar acceso`
- `Ver demo`
- `Conocer el flujo`
- `Hablar con el equipo`

Recomendacion para el hero:

- CTA primario: `Solicitar acceso`
- CTA secundario: `Conocer el flujo`

## 8. Sistema visual obligatorio

La landing debe usar el sistema visual real de Anamneo. Estos valores vienen de la app actual y son la fuente de verdad para construir fuera del repo principal.

### Paleta

```css
/* Superficies */
--surface-base: #ebe9e4;      /* fondo general calido */
--surface-elevated: #fdfcfb;  /* cards y paneles */
--surface-muted: #e5e4e0;     /* separadores suaves */
--surface-inset: #f5f4f0;     /* campos, bloques internos */

/* Frame y texto */
--frame: #404040;
--frame-dark: #2b2b2b;
--ink: #2b2b2b;
--ink-secondary: #555555;
--ink-muted: #767676;
--ink-on-dark: #ffffff;

/* Acento */
--accent: #eaf832;
--accent-bright: #f3fe48;
--accent-text: #2b2b2b;

/* Estado */
--status-red: #D08C84;
--status-red-text: #7f1d1d;
--status-yellow: #E5D86A;
--status-green: #96B38A;
--status-green-text: #1a5d38;
```

### Tipografia

- Familia: `Inter`, `system-ui`, `sans-serif`.
- Texto base: 15px aproximado, line-height 1.6.
- Microcopy/labels: 12-13px.
- Titulos internos: 20px, bold.
- Titular de landing: puede crecer mas que la app, pero debe mantener una sensacion sobria. Rango sugerido: 44-64px desktop, 36-42px mobile.
- No usar letter spacing negativo.
- Pesos principales: 600, 700, 800.

### Radios y sombras

```css
--radius-shell: 2.5rem;
--radius-card: 2rem;
--radius-input: 999px;
--radius-pill: 999px;
--radius-small: 1rem;

--shadow-soft: 0 1px 4px rgba(43, 43, 43, 0.04);
--shadow-card: 0 8px 24px rgba(43, 43, 43, 0.06);
--shadow-elevated: 0 12px 30px rgba(43, 43, 43, 0.08);
--shadow-dropdown: 0 18px 40px rgba(43, 43, 43, 0.12);
```

### Iconografia y controles

- Usar iconos lineales tipo `react-icons/fi` o una familia equivalente de trazo simple.
- Botones principales tipo pill.
- Boton oscuro para CTA principal: fondo `--frame-dark`, texto blanco.
- Boton secundario claro: fondo `--surface-elevated`, borde `--surface-muted`, texto `--ink-secondary`.
- El lima se usa para foco, progreso, estados activos o pequenos highlights, no como fondo decorativo dominante.
- Cards con fondo `--surface-elevated`, borde sutil y sombra suave.
- Evitar gradientes brillantes, blobs, orbes, fondos azules medicos, ilustraciones SaaS genericas y mockups imposibles de leer.

## 9. Sensacion visual de producto

Anamneo se siente como un cockpit clinico calido: sidebar oscura, contenido en superficies crema y cards modulares para revisar y completar informacion sin ruido. No intenta parecer una landing brillante; parece una herramienta diaria, calmada y seria, donde cada pantalla tiene una funcion clara.

Valores visuales:

- jerarquia clara,
- poco ruido,
- acciones visibles,
- estados clinicos faciles de leer,
- formularios amplios y tactiles,
- navegacion persistente,
- senales de progreso,
- separacion fuerte entre dashboard, ficha de paciente y workspace de atencion.

Pantallas que la landing puede recrear:

- Login con marco oscuro, chips de confianza, 2FA y mensaje de acceso por invitacion.
- Dashboard clinico con saludo, acciones rapidas, pacientes recientes y alertas de tareas.
- Pacientes con busqueda, filtros, completitud y acciones.
- Ficha longitudinal con cabecera clinica, validacion, exportaciones, problemas, tareas, signos vitales, alertas, consentimientos e historial.
- Atenciones con filtros por estado, metricas rapidas y busqueda.
- Workspace de atencion con rail lateral de secciones, toolbar superior, progreso, warnings, resumen del paciente, recuperacion de borradores, formulario activo y cierre.
- Analitica clinica con filtros, metricas, tablas rankeadas y exportaciones.
- Catalogo de afecciones/medicamentos.
- Plantillas de texto clinico.
- Admin, auditoria y ajustes.

## 10. Estructura recomendada de la landing

### 1. Hero

Objetivo: comunicar producto y estetica en menos de 10 segundos.

Contenido:

- H1: `Ficha clinica moderna para consultas que necesitan orden, continuidad y trazabilidad.`
- Bajada: `Anamneo reune pacientes, atenciones por secciones, seguimiento, adjuntos, catalogos y auditoria en una experiencia clinica calida y precisa, disenada para equipos medicos en Chile.`
- CTA primario: `Solicitar acceso`
- CTA secundario: `Conocer el flujo`
- Visual: composicion realista de UI con dashboard, ficha de paciente y workspace de atencion. Usar crema, frame oscuro y acento lima, con cards redondeadas y densidad clinica moderada.

### 2. Flujo clinico completo

Tres pasos:

1. `Registra y verifica pacientes`
2. `Documenta atenciones por secciones`
3. `Cierra, firma y da seguimiento`

Copy:

`Anamneo acompana el flujo completo de la consulta, no solo la nota final.`

### 3. Workspace de atencion

Destacar:

- rail de secciones,
- progreso,
- guardado por seccion,
- recuperacion de borradores,
- warnings clinicos,
- cierre y firma.

Copy:

`El encuentro se trabaja como una secuencia clinica clara: motivo, anamnesis, examen, sospecha, tratamiento, respuesta y observaciones. Cada seccion tiene estado, permisos y contexto.`

### 4. Ficha longitudinal

Destacar:

- timeline de atenciones,
- antecedentes,
- problemas,
- tareas,
- consentimientos,
- alertas,
- adjuntos,
- exportacion.

Copy:

`La historia del paciente vive en una linea continua: datos verificados, documentos, evolucion, pendientes y decisiones clinicas disponibles desde una misma ficha.`

### 5. Equipo y permisos

Destacar:

- medico,
- asistente,
- administrador,
- permisos por accion,
- relaciones medico-asistente.

Copy:

`Recepcion puede preparar. El medico decide y firma. Administracion gobierna usuarios y auditoria. Cada rol trabaja con limites claros.`

### 6. Catalogos y analitica

Destacar:

- afecciones globales/locales,
- medicamentos,
- sugerencias registradas,
- cohortes,
- patrones de tratamiento,
- exportes CSV/Markdown.

Copy:

`Los datos clinicos estructurados no se quedan enterrados: Anamneo permite explorar cohortes, tratamientos y desenlaces proxy desde atenciones completadas o firmadas.`

Nota de precision: esta analitica es descriptiva y observacional; no debe presentarse como predictiva ni causal.

### 7. Seguridad practica

Destacar:

- cookies `HttpOnly`,
- 2FA,
- sesiones por dispositivo,
- auditoria,
- permisos compartidos,
- backups/restore drills,
- cifrado de settings y recomendacion de filesystem cifrado.

Copy:

`Seguridad sin teatro: sesiones revocables, 2FA, auditoria persistente, permisos por rol y operacion documentada para reducir riesgos reales.`

### 8. Cierre

Frase final:

`Una ficha clinica disenada para que el equipo vuelva a pensar en pacientes, no en donde quedo la informacion.`

CTA:

`Solicitar acceso`

## 11. Recursos visuales recomendados

Usar capturas reales o recreaciones fieles de:

- dashboard clinico,
- lista de pacientes con completitud,
- ficha longitudinal,
- workspace de atencion con rail de secciones,
- analitica clinica con metricas y tablas,
- estados vacios, progreso y avisos de verificacion.

Evitar:

- fotos genericas de medicos sonriendo,
- mockups de laptop con pantallas ilegibles,
- ilustraciones medicas azules genericas,
- claims visuales de IA,
- exceso de gradientes,
- iconografia de cruz medica usada como decoracion principal,
- testimonios, logos o numeros inventados.

## 12. Copy corto reutilizable

- `Atenciones por secciones, no notas perdidas.`
- `Ficha longitudinal con contexto clinico y operativo.`
- `Seguimientos, consentimientos y adjuntos en el mismo flujo.`
- `Permisos claros para medico, asistente y administrador.`
- `Catalogos clinicos globales y locales.`
- `Analitica descriptiva y exportable desde atenciones completadas.`
- `Auditoria persistente para cambios sensibles.`
- `Disenado para consultas medicas en Chile.`
- `Recepcion prepara. El medico decide. Administracion audita.`
- `Menos papeleo. Mas continuidad clinica.`

## 13. Checklist para quien implemente

- La landing debe ser publica y vivir en un repo separado; no asumir dependencias del frontend principal.
- Implementar la paleta exacta de este documento.
- Usar Inter o fallback equivalente.
- Mantener el primer viewport con producto visible: no solo texto.
- Construir una recreacion legible de UI, no una imagen decorativa borrosa.
- Mantener CTA de acceso/invitacion, no registro libre.
- Usar copy en espanol chileno neutro, profesional y directo.
- No prometer agenda, facturacion, IA medica, firma legal avanzada ni cifrado propio de SQLite.
- Verificar responsive mobile: el hero debe mostrar marca, mensaje, CTA y al menos una senal visual del producto sin solapamientos.
- Revisar contraste: texto principal sobre crema debe usar `--ink`; texto sobre frame oscuro debe usar blanco o lima con moderacion.

## 14. Resumen ejecutivo

Anamneo debe presentarse como una ficha clinica moderna, sobria y confiable. Su mayor fortaleza no es una feature aislada: es la combinacion de flujo clinico por secciones, ficha longitudinal, roles claros, seguimiento, adjuntos, catalogos, analitica y auditoria en una interfaz calida que no parece software medico heredado.

La landing debe vender orden clinico, continuidad y trazabilidad. Eso es mas fuerte, mas cierto y mas diferenciador que prometer inteligencia artificial o seguridad absoluta.
