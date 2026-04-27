# Anamneo: análisis funcional, visual y narrativa para landing page

Este documento resume lo que Anamneo hace hoy, cómo se ve la aplicación y qué conviene contar en una landing page sin exagerar capacidades que todavía son backlog o dependen de infraestructura externa.

## 1. Qué es Anamneo

Anamneo es una plataforma de gestión de fichas clínicas para consultas médicas en Chile. Su centro no es la agenda ni la facturación: es la documentación clínica completa, desde el alta del paciente hasta el cierre, firma, seguimiento, adjuntos, auditoría y exportación de la historia.

La promesa más honesta:

> Anamneo ordena el trabajo clínico diario en una ficha longitudinal segura, rápida de completar y preparada para continuidad médica.

El producto está diseñado para médicos y equipos pequeños o medianos que necesitan menos papel, menos Excel heredado y más trazabilidad sobre lo que ocurrió en cada atención.

## 2. Qué hace la app

### Pacientes

- Registro de pacientes con validación de RUT y soporte para pacientes exentos de RUT.
- Alta rápida o completa mediante `registrationMode`.
- Estado de completitud de ficha: incompleta, pendiente de verificación o verificada.
- Validación demográfica con responsable y fecha.
- Detección de posibles duplicados y flujo de consolidación.
- Archivado/restauración con soft delete.
- Vista de ficha longitudinal con información personal, antecedentes, problemas, alertas, consentimientos, tareas, signos vitales, adjuntos y timeline de atenciones.
- Exportación de historial PDF y paquete clínico cuando la ficha cumple requisitos de verificación.

### Atenciones clínicas

- Creación de atenciones asociadas a un paciente.
- Flujo por secciones clínicas, con navegación lateral, progreso y estados por sección.
- Secciones visibles en el código: identificación, motivo de consulta, anamnesis próxima, anamnesis remota, revisión por sistemas, examen físico, sospecha diagnóstica, tratamiento, respuesta al tratamiento y observaciones.
- Guardado por sección, manejo de cambios sin guardar y recuperación de borradores locales.
- Detección de conflictos entre copia local y versión de servidor.
- Bloqueos de salida clínica cuando falta verificar información crítica del paciente.
- Cierre de atención con checklist, nota de cierre y seguimiento vinculado.
- Firma de atención mediante modal específico.
- Reapertura, cancelación, impresión/exportación e historial de auditoría según permisos y estado.

### Seguimientos y tareas

- Bandeja de seguimientos.
- Tareas clínicas u operativas con prioridad, estado y fecha límite.
- Alertas visibles para tareas vencidas, tareas que vencen hoy, tareas de la semana y trámites próximos.
- Acceso desde dashboard, paciente y flujo de atención.

### Catálogos clínicos

- Catálogo global de afecciones.
- Catálogo local por médico o instancia.
- Sugerencias de afección basadas en texto de motivo de consulta.
- Registro de la decisión tomada por el médico: automática, manual o confirmada.
- Importación CSV de afecciones por administrador, con preview server-side y consolidación de duplicados.
- Catálogo global de medicamentos con nombre, principio activo, estado activo e importación CSV.

### Analítica clínica

- Vista restringida a médicos no administradores.
- Cohortes por afección, síntoma o fuente diagnóstica.
- Filtros por fecha, ventana de seguimiento y límite de resultados.
- Métricas sobre pacientes, atenciones, cobertura de tratamiento estructurado, reconsulta, ajustes terapéuticos, problemas resueltos, alertas posteriores, adherencia documentada y eventos adversos.
- Rankings de afecciones, síntomas, medicamentos, exámenes y derivaciones.
- Drill-down hacia casos.
- Exportación de resumen en CSV y reporte Markdown.

### Consentimientos, alertas y adjuntos

- Consentimientos informados con otorgamiento, revocación y motivo.
- Alertas clínicas con severidad, origen y acuse.
- Adjuntos vinculados a paciente, atención u órdenes.
- Previsualización de adjuntos mediante modal.
- Acceso protegido por permisos y relación efectiva con paciente/atención.

### Administración

- Primer registro con bootstrap de administrador.
- Luego, acceso por invitación.
- Gestión de usuarios, roles y relaciones médico-asistente.
- Auditoría central filtrable.
- Ajustes de plataforma, política de sesión, SMTP y configuración operativa.
- Catálogos globales administrables.

### Seguridad y operación

- Autenticación por cookies `HttpOnly` con access token y refresh token.
- Sesiones persistidas por dispositivo y revocables.
- Soporte 2FA/TOTP y códigos de recuperación.
- Protección contra intentos de login repetidos.
- Permisos compartidos entre frontend y backend para acciones sensibles de atenciones.
- Auditoría persistente con entidad, usuario, acción, diff, request id, timestamps y hashes de integridad.
- Settings sensibles cifrados a nivel aplicación.
- En producción, la app exige confirmación de cifrado del filesystem para base de datos, uploads y backups.
- Operación simple con Docker Compose, SQLite WAL, backups y restore drills documentados.

## 3. Quién usa Anamneo

### Médico

Es el usuario principal del producto. Crea y completa atenciones, valida fichas, registra decisiones clínicas, revisa historia longitudinal, firma encuentros, exporta información clínica y consulta analítica.

Mensaje para landing:

> Un espacio de trabajo clínico para atender, documentar y cerrar con trazabilidad.

### Asistente

Apoya el flujo operativo: registro de pacientes, datos administrativos, preparación de atenciones, adjuntos y seguimiento. Sus permisos son más restringidos en contenido clínico sensible.

Mensaje para landing:

> Recepción puede avanzar trabajo sin invadir decisiones médicas.

### Administrador

Gestiona usuarios, catálogos, settings y auditoría. No debe presentarse como “dueño clínico” del dato. La narrativa correcta es gobierno operativo con límites.

Mensaje para landing:

> Administración clara, trazabilidad visible y menor riesgo de permisos ambiguos.

## 4. Cómo se ve la app

Anamneo no se ve como software hospitalario clásico. La interfaz actual se siente como un cockpit clínico cálido: ordenado, sobrio y pensado para trabajar rápido sin cargar visualmente al equipo. Evita el blanco quirúrgico, el azul corporativo y los paneles duros; en su lugar usa superficies crema, marcos oscuros, acentos lima y una jerarquía compacta que prioriza lectura y acción.

### Identidad visual

- Base visual cálida en crema, con superficies elevadas casi blancas y marcos charcoal que delimitan la navegación y los paneles.
- Acento lima reservado para foco, progreso y estados activos; no se usa como color decorativo constante.
- Texto principal en negro suave, con estados semánticos apagados para error, alerta y éxito.
- Tipografía Inter como base única, con pesos semibold y bold para construir jerarquía.
- Cards, shells y controles con radios amplios, sombras suaves y bordes sutiles.
- Acciones principales en formato pill o botón compacto, con iconografía lineal de `react-icons/fi`.
- La sensación general es de una herramienta clínica seria, no de una landing SaaS brillante.

### Sensación de producto

La app se siente como un cockpit clínico: sidebar oscura, contenido en superficies crema y cards modulares para revisar y completar información sin ruido. No intenta parecer una landing SaaS con brillo decorativo; parece una herramienta diaria, calmada y seria, donde cada pantalla tiene una función clara.

El valor visual está en:

- jerarquía clara,
- poco ruido,
- acciones visibles,
- estados clínicos fáciles de leer,
- formularios amplios y con buen espacio táctil,
- navegación persistente,
- señales de progreso,
- y una separación fuerte entre dashboard, ficha de paciente y workspace de atención.

### Pantallas principales observadas

- **Login:** pantalla de acceso con marco de autenticación, chips de confianza, 2FA y mensaje de acceso por invitación cuando ya existe administrador.
- **Dashboard clínico:** saludo, acciones rápidas, estado del flujo, actividad reciente, pacientes recientes y alertas de tareas vencidas.
- **Pacientes:** listado con búsqueda, filtros, resumen de completitud y acciones para nuevo paciente o nueva atención.
- **Ficha de paciente:** vista longitudinal con cabecera clínica, validación de ficha, exportaciones, problemas, tareas, signos vitales, alertas, consentimientos e historial.
- **Atenciones:** bandeja con filtros por estado y revisión, métricas rápidas y búsqueda por paciente.
- **Workspace de atención:** experiencia central del producto; rail lateral de secciones, toolbar superior, progreso, warnings clínicos, resumen del paciente, recuperación de borradores, formulario activo y bloque de cierre visible.
- **Analítica clínica:** tablero médico con filtros, métricas, tablas rankeadas, desenlaces proxy y exportaciones.
- **Catálogo:** gobierno de afecciones y medicamentos.
- **Plantillas:** reutilización de texto para acelerar documentación.
- **Admin:** usuarios y auditoría.
- **Ajustes:** configuración operativa.

## 5. Diferenciadores reales para comunicar

### Ficha longitudinal, no notas sueltas

Anamneo no guarda solamente textos aislados. Conecta paciente, historia, problemas, tareas, consentimientos, alertas, adjuntos y atenciones en una vista longitudinal que se lee más como expediente clínico que como formulario suelto.

### Atención por secciones

El encuentro clínico se trabaja por bloques. Esto reduce carga cognitiva y permite guardar, revisar y cerrar con más orden, usando una secuencia clínica visible en lugar de una pantalla monolítica.

### Continuidad y recuperación

El workspace contempla autoguardado, estado de cambios, recuperación de borradores locales y manejo de conflictos. Es una ventaja potente para uso real, donde la red, el navegador o el tiempo del médico fallan, y además refuerza la sensación de producto diseñado para trabajo largo.

### Permisos pensados para equipos

Médico, asistente y administrador no ven ni editan lo mismo. Esto permite delegar trabajo sin entregar control total de la ficha.

### Salida clínica con condiciones

El producto contempla bloquear exportaciones o cierres cuando falta verificación relevante. Eso transmite seriedad: no todo dato está listo para transformarse en documento oficial, y la UI lo comunica con estados y avisos claros.

### Catálogos y sugerencias

El sistema acompaña el diagnóstico con catálogos globales/locales y sugerencias registradas. No reemplaza criterio médico; ordena la selección y deja trazabilidad.

### Analítica desde documentación real

La analítica clínica se apoya en atenciones completadas o firmadas para construir cohortes, patrones y reportes exportables.

### Auditoría y operación sobria

El producto registra acciones, diffs y hashes, y además incluye una estrategia operativa simple basada en Docker Compose, SQLite, backups y restore drills. Visualmente esto se traduce en una UI que prefiere trazabilidad legible antes que adornos.

## 6. Cosas que no conviene prometer de más

Evitar en la landing, salvo que se implemente explícitamente:

- “NLP clínico avanzado” como motor general. Hoy hay sugerencias y analítica basada en estructuras/campos, pero no conviene venderlo como IA médica amplia.
- “SQLite cifrado por la app”. La app cifra settings sensibles; base, uploads y backups dependen del cifrado del filesystem.
- “Admin-blind absoluto” como promesa legal cerrada. Hay controles por rol y permisos; formularlo como límites de acceso y trazabilidad.
- “Firma digital legal avanzada”. Existe firma/cierre con re-verificación y trazabilidad, pero no describirlo como firma electrónica avanzada sin soporte legal explícito.
- “Gratis” o “comenzar ahora” si el acceso real es bootstrap inicial e invitaciones.
- Logos de instituciones o testimonios ficticios.

## 7. Narrativa recomendada para la landing

### Tesis

> La ficha clínica no debería sentirse como papeleo digital. Debería acompañar el razonamiento médico, proteger la continuidad del paciente y dejar trazabilidad sin fricción.

### Posicionamiento

Anamneo es una ficha clínica moderna para consultas médicas que necesitan documentación ordenada, flujos por rol, seguimiento y auditoría, sin cargar al equipo con un sistema corporativo enorme.

### Tono

- Profesional, cálido y directo.
- Evitar claims grandilocuentes de IA.
- Hablar de orden, continuidad, seguridad práctica y menos fricción.
- No sonar como hospital enterprise ni como app genérica de productividad.

### Headlines posibles

1. `Ficha clínica moderna para consultas que necesitan orden, continuidad y trazabilidad.`
2. `Documenta la atención completa sin perder el hilo clínico.`
3. `Del primer registro al seguimiento: una ficha clínica que acompaña el flujo real de consulta.`
4. `Menos papeleo. Más continuidad clínica.`

### Subheadline sugerido

`Anamneo reúne pacientes, atenciones por secciones, adjuntos, consentimientos, tareas, catálogos y auditoría en un workspace clínico diseñado para equipos médicos en Chile.`

### CTA recomendado

Como el acceso puede ser por invitación, evitar “Empieza gratis”. Usar:

- `Solicitar acceso`
- `Ver demo`
- `Conocer el flujo`
- `Hablar con el equipo`

## 8. Estructura propuesta de landing

### Hero

Objetivo: comunicar producto y estética en menos de 10 segundos.

Contenido:

- H1: `Ficha clínica moderna para consultas que necesitan orden, continuidad y trazabilidad.`
- Bajada: `Anamneo reúne pacientes, atenciones por secciones, seguimiento, adjuntos, catálogos y auditoría en una experiencia clínica cálida y precisa.`
- CTA primario: `Ver demo`
- CTA secundario: `Explorar funciones`
- Visual: composición realista de UI con dashboard, ficha de paciente y workspace de atención. Usar crema, frame oscuro y acento lima, con cards redondeadas y densidad clínica moderada.

### Sección: flujo clínico completo

Tres pasos:

1. `Registra y verifica pacientes`
2. `Documenta atenciones por secciones`
3. `Cierra, firma y da seguimiento`

Mensaje:

`Anamneo acompaña el flujo completo de la consulta, no solo la nota final.`

### Sección: workspace de atención

Destacar:

- rail de secciones,
- progreso,
- guardado por sección,
- recuperación de borradores,
- warnings clínicos,
- cierre y firma.

Copy:

`El encuentro se trabaja como una secuencia clínica clara: motivo, anamnesis, examen, sospecha, tratamiento, respuesta y observaciones. Cada sección tiene estado, permisos y contexto.`

### Sección: ficha longitudinal

Destacar:

- timeline de atenciones,
- antecedentes,
- problemas,
- tareas,
- consentimientos,
- alertas,
- adjuntos,
- exportación.

Copy:

`La historia del paciente vive en una línea continua: datos verificados, documentos, evolución, pendientes y decisiones clínicas disponibles desde una misma ficha.`

### Sección: equipo y permisos

Destacar:

- médico,
- asistente,
- administrador,
- permisos por acción,
- relaciones médico-asistente.

Copy:

`Recepción puede preparar. El médico decide y firma. Administración gobierna usuarios y auditoría. Cada rol trabaja con límites claros.`

### Sección: catálogos y analítica

Destacar:

- afecciones globales/locales,
- medicamentos,
- sugerencias registradas,
- cohortes,
- patrones de tratamiento,
- exportes CSV/Markdown.

Copy:

`Los datos clínicos estructurados no se quedan enterrados: Anamneo permite explorar cohortes, tratamientos y desenlaces proxy desde atenciones completadas o firmadas.`

### Sección: seguridad práctica

Destacar:

- cookies `HttpOnly`,
- 2FA,
- sesiones por dispositivo,
- auditoría,
- permisos compartidos,
- backups/restore drills,
- cifrado de settings y recomendación de filesystem cifrado.

Copy:

`Seguridad sin teatro: sesiones revocables, 2FA, auditoría persistente, permisos por rol y operación documentada para reducir riesgos reales.`

### Cierre

H1 corto o frase final:

`Una ficha clínica diseñada para que el equipo vuelva a pensar en pacientes, no en dónde quedó la información.`

CTA:

`Solicitar acceso`

## 9. Recursos visuales recomendados

Usar capturas o recreaciones fieles de:

- dashboard clínico,
- lista de pacientes con cards de completitud,
- ficha longitudinal de paciente,
- workspace de atención con rail de secciones,
- analítica clínica con métricas y tablas,
- pantallas con estados vacíos, progreso y avisos de verificación para mostrar el carácter operativo de la interfaz.

Evitar:

- fotos genéricas de médicos sonriendo,
- mockups de laptop con pantallas ilegibles,
- ilustraciones médicas azules genéricas,
- claims visuales de IA si la página no explica límites,
- exceso de gradientes o recursos visuales que parezcan genéricos de SaaS.

## 10. Copy corto reutilizable

- `Atenciones por secciones, no notas perdidas.`
- `Ficha longitudinal con contexto clínico y operativo.`
- `Seguimientos, consentimientos y adjuntos en el mismo flujo.`
- `Permisos claros para médico, asistente y administrador.`
- `Catálogos clínicos globales y locales.`
- `Analítica exportable desde atenciones completadas.`
- `Auditoría persistente para cambios sensibles.`
- `Diseñado para consultas médicas en Chile.`

## 11. Resumen ejecutivo

Anamneo debe presentarse como una ficha clínica moderna, sobria y confiable. Su mayor fortaleza no es una feature aislada: es la combinación de flujo clínico por secciones, ficha longitudinal, roles claros, seguimiento, adjuntos, catálogos, analítica y auditoría en una interfaz cálida que no parece software médico heredado.

La landing debería vender orden clínico, continuidad y trazabilidad. Eso es más fuerte, más cierto y más diferenciador que prometer inteligencia artificial o seguridad absoluta.
