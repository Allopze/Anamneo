# Anamneo: Visión de Landing Page y Análisis Estético

Este documento detalla el análisis de la identidad visual de Anamneo y define la estructura y el "mood" para su futura Landing Page.

---

## 1. Análisis de Estética y UI/UX (Audit)

Anamneo rompe con el estándar de "software médico tradicional" (usualmente azul estéril, rígido y saturado) para adoptar una estética que podemos denominar **"Modern Clinical Boutique"**.

* **Paleta de Colores (The "Cream & Lime" Signature):**
  * **Base Warm-Cream (`#ebe9e4`):** Sustituye al blanco puro de hospital por un tono crema que transmite calidez y calma, reduciendo la fatiga visual del médico.
  * **Frame Charcoal (`#2b2b2b`):** El uso de grises casi negros para la estructura (sidebars, textos principales) le da un peso institucional y de "herramienta profesional" seria.
  * **Lime Accent (`#eaf832`):** Es el toque maestro. Un verde lima vibrante que grita "tecnología moderna" y "frescura", usado estratégicamente para acciones clave (CTAs) y estados activos.
* **Lenguaje de Formas (Organic & Rounded):**
  * Con radios de curvatura extremos (desde `1rem` hasta `2.5rem` en el shell principal), la aplicación se siente como un objeto físico pulido, eliminando la agresividad de las esquinas rectas.
  * **Efecto "Bento Grid":** La información se organiza en tarjetas modulares con sombras suaves (`0 8px 24px rgba(43,43,43,0.06)`), lo que facilita la jerarquía visual sin necesidad de líneas divisorias invasivas.
* **Filosofía UX:**
  * **El Dashboard como Cockpit:** El diseño está pensado para la eficiencia clínica. No hay distracciones; cada elemento está orientado a la toma de datos (anamnesis) y la revisión rápida.
  * **Integridad por Diseño:** La arquitectura técnica (auditoría inmutable, firmas) se refleja en una interfaz limpia que no necesita "adornos" porque su valor está en la precisión del dato.

---

## 2. Prompt Detallado para la Landing Page

Este prompt describe una Landing Page que no solo vende un software, sino un **estándar de práctica médica superior**.

**Título del Prompt:** *"The Anamneo Experience: Clinical Precision in a Boutique Shell"*

### Sección 1: Hero - "La Evolución de la Ficha Clínica"

* **Fondo:** Color crema sólido (`#fdfcfb`) con una sutil malla de puntos (grid) de fondo.
* **Titular (Headline):** Tipografía Inter, peso 800, tamaño Hero. *"Documentación clínica que se siente como el futuro."*
* **Subtítulo:** *"Anamneo combina la seguridad de grado médico con una estética boutique diseñada para consultorios de alto nivel."*
* **Visual:** Una composición central de "Bento Cards" flotantes que muestran fragmentos de la UI: una tarjeta de constantes vitales con una micro-gráfica, un selector de medicamentos estructurado y un sello de "Historia Clínica Firmada".
* **CTA Principal:** Un botón tipo cápsula (pill) en color Lime Accent (`#eaf832`) con texto en negro: *"Comenzar ahora — Es gratis"*.

### Sección 2: El Manifiesto Visual (Bento Grid)

* **Concepto:** Tres tarjetas grandes con esquinas muy redondeadas (`3xl`) que expliquen los pilares:
  1. **"Estética que Calma":** Mostrar cómo el diseño Warm-Cream reduce el estrés visual durante jornadas largas.
  2. **"Integridad Inmutable":** Un gráfico abstracto que represente la cadena de hashes de la auditoría, transmitiendo seguridad total sobre los datos.
  3. **"Flujo Natural":** Una captura del editor de encuentros (SOAP) que destaque la limpieza del campo de texto y la rapidez de los atajos de teclado.

### Sección 3: "Seguridad que no estorba"

* **Estética:** Fondo oscuro (`#2b2b2b`) para contrastar drásticamente. El texto en blanco y detalles en verde lima.
* **Mensaje:** Enfocarse en que Anamneo es técnicamente superior (SQLite cifrado, backups automáticos, auditoría por evento) pero invisible para el usuario.
* **Iconografía:** Minimalista, líneas finas (tipo Feather Icons) en color lima.

### Sección 4: Social Proof & Trust

* **Visual:** Logotipos de instituciones o tipos de especialistas (ej: "Pediatría", "Neurología") en gris suave, con una cita central de un médico hipotético: *"Anamneo no es solo un EMR, es el cockpit donde mi práctica cobra orden."*

### Sección 5: Footer - Final de Trayecto

* **Diseño:** Muy simple. El logo de Anamneo en negro sobre fondo crema.
* **Cierre:** *"Diseñado en Chile para el mundo médico moderno."*

---

## 3. Catálogo Completo de Funcionalidades (The Superpowers)

Esta sección detalla las capacidades técnicas extraídas directamente del análisis del código fuente, que deben ser destacadas en la Landing Page como factores diferenciadores.

### A. Inteligencia y Analítica Clínica Avanzada

* **Motor de NLP Clínico:** Procesamiento de lenguaje natural sobre notas SOAP para extraer automáticamente síntomas, señales de dolor y resultados de tratamiento.
* **Clasificación Automática de Patrones:** Capacidad de identificar relaciones complejas (ej: dolor abdominal asociado a ingesta) a partir de texto libre.
* **Codificación CIE-10 Integrada y Catálogos Híbridos:** Buscador semántico de diagnósticos basado en CIE-10, soportado por catálogos globales importables y catálogos locales personalizables por cada profesional.
* **Vinculación Terapéutica Explícita:** A diferencia de recetarios simples, Anamneo vincula exactamente qué tratamiento responde a qué sospecha diagnóstica, generando estadísticas de efectividad de prescripciones a nivel poblacional.
* **Analítica de Efectividad y Bioestadística:** Dashboard clínico con capacidades de drill-down para crear cohortes descriptivas, rastrear ajustes terapéuticos y exportar reportes ejecutivos en formatos Markdown y CSV.

### B. Seguridad, Identidad y Resiliencia de Grado Legal

* **Cadena de Auditoría Criptográfica (SHA-256):** Sistema de logs inmutable donde cada evento está encadenado, garantizando la integridad forense de la ficha y de las acciones del sistema.
* **Arquitectura "Admin-Blind" y Control de Acceso Estricto:** Diseño de permisos que impide al administrador leer datos clínicos (PHI). Reforzado con Doble Factor de Autenticación (2FA/TOTP) y gestión individual de sesiones persistidas.
* **Firmas Digitales y Snapshot de Identidad:** Proceso de cierre de atenciones con re-verificación de identidad y captura del estado exacto del paciente (Snapshot) en el momento de la consulta para preservar la coherencia legal.
* **Onboarding Cerrado y Seguro:** El alta de usuarios no es pública. Se realiza exclusivamente a través de invitaciones cifradas enviadas por email con roles y relaciones (ej. "Médico asignado") preconfiguradas.
* **Resiliencia Operativa Automatizada:** Respaldo de información constante gracias a backups encriptados y "restore drills" (pruebas de restauración automatizadas) que garantizan recuperación de datos ante desastres.

### C. Flujo de Trabajo y Experiencia "Cockpit"

* **Dashboard Multivista:** Paneles especializados (visión Clínica vs Administrativa) con alertas inmediatas sobre tareas pendientes, pacientes recientes y flujos operativos críticos.
* **Workspace de Encuentros (SOAP) Resiliente:** Interfaz clínica optimizada (con paneles laterales ocultables) y capacidad de guardado de borradores offline (vía IndexedDB) previniendo pérdida de datos por fallos de red.
* **Gestor de Plantillas y Duplicación Inteligente:** Reducción drástica del tiempo de escritura mediante atajos, plantillas predefinidas por sección y duplicación de historiales previos para consultas de seguimiento rápidas.
* **Timeline Clínico Unificado:** Visualización cronológica inmersiva del historial de un paciente, integrando sin fisuras sus atenciones, evolución y documentos en una única línea de tiempo.

### D. Gestión Integral y Gobernanza del Dato

* **Alertas Automatizadas de Signos Vitales:** Monitor preventivo que genera alertas clínicas ("Clinical Alerts") si los parámetros vitales del paciente exceden los umbrales de riesgo.
* **Seguimiento por "Episodios Clínicos":** Agrupación inteligente de múltiples consultas longitudinales bajo un mismo "episodio" de salud, dando contexto continuo a tratamientos crónicos.
* **Sistema de Tareas y Recurrencia:** Gestión integrada de pendientes (To-Do's) clínicos y recordatorios de controles periódicos asignados a pacientes específicos, con fechas límite y prioridades.
* **Módulo de Medicación y Respuesta Estructurada:** Trazabilidad profunda que incluye dosis, adherencia, eventos adversos y el impacto explícito (outcomes) de los tratamientos a lo largo del tiempo.
* **Gestor de Adjuntos Clínicos Seguros:** Archivo digital eficiente con previsualización rápida, URLs expirables y categorización estandarizada de exámenes.
* **Exportación de Bundles Clínicos:** Potente capacidad de generar paquetes exportables completos de datos clínicos (portabilidad de información), facilitando auditorías y mudanzas de datos.
* **Delegación Asistida:** Roles diferenciados (Médico vs Asistente) que permiten delegar la carga administrativa y preparación de atenciones sin comprometer la autoridad de edición de la ficha médica.

---

## 4. Guía Conceptual y Narrativa (Storytelling & Context)

Para que el *copy* de la Landing Page resuene con los profesionales, es vital entender el **porqué**, el **cómo** y **quiénes** interactúan en Anamneo.

### A. El Contexto: ¿Por qué existe Anamneo?

La mayoría del software médico actual sufre de dos grandes problemas: o son herramientas corporativas saturadas de funciones que los médicos independientes no necesitan (lentitud, clics infinitos, interfaces hostiles), o son apps demasiado simples que carecen de rigor legal y seguridad. 
**Anamneo nace para llenar ese vacío:** Ofrece una experiencia de usuario (UX) propia de una aplicación *boutique* de consumo, combinada con una arquitectura de seguridad forense y analítica clínica avanzada. Es el software que respeta el tiempo del médico y la privacidad del paciente.

### B. El Flujo Clínico: ¿Cómo funciona en la práctica?

Anamneo está diseñado para minimizar la fricción desde que el paciente cruza la puerta hasta que se archiva su ficha.

1. **Recepción y Preparación (Asistente):** El asistente recibe al paciente, actualiza sus datos administrativos (teléfono, previsión) en el *Timeline Unificado* y carga cualquier examen previo (Adjuntos Seguros). Luego, puede dejar un "Borrador de Atención" preparado para el médico.
2. **Atención en el "Cockpit" (Médico):** El médico abre la ficha. Sin distracciones, revisa el historial en la línea de tiempo. Inicia el encuentro (SOAP). Usa atajos de teclado, autocompletado y plantillas para llenar la anamnesis rápidamente.
3. **Decisión Clínica y Analítica:** El médico selecciona la sospecha diagnóstica (apoyado por el catálogo CIE-10) e indica el tratamiento (medicamentos, derivaciones). El sistema enlaza automáticamente el tratamiento con el diagnóstico para futuras bioestadísticas.
4. **Cierre y Firma Inmutable:** Una vez finalizada la consulta, el médico presiona "Completar". Se le exige re-verificar su identidad (Firma). En ese instante, Anamneo toma un *Snapshot* del paciente, cifra los datos y crea un registro inmutable en la cadena de auditoría (SHA-256). El encuentro queda sellado legalmente.

### C. Roles y Gobernanza (Quién hace qué)

La plataforma reconoce que la salud es un trabajo en equipo, pero los límites de privacidad deben ser estrictos.

* **El Médico (Control Total Clínico):** Es el único dueño de la información de salud (PHI). Puede ver historias, prescribir, firmar atenciones y acceder a la analítica de sus casos.
* **El Asistente (Soporte Operativo):** Tiene una vista restringida. Gestiona el directorio de pacientes, actualiza datos demográficos y prepara archivos, pero **no puede** alterar planes terapéuticos ni firmar atenciones.
* **El Administrador (Soporte Técnico "Blind"):** Configura el sistema, maneja respaldos y audita la seguridad, pero tiene **acceso ciego (Admin-Blind)**. Por diseño, el sistema bloquea su acceso a los diagnósticos y notas de los pacientes, asegurando el cumplimiento de leyes de privacidad internacionales.

### D. Seguridad Invisible pero Inquebrantable

En la Landing Page, la seguridad no debe venderse como un "extra", sino como el cimiento del producto.

* **Forense e Inmutable:** No es solo una base de datos. Cada acción genera un *hash* criptográfico encadenado al anterior. Si alguien intenta alterar un registro directamente en la base de datos, la cadena se rompe y el sistema alerta de la intrusión.
* **Protección Anti-Catástrofes:** Backups encriptados automáticos y *Restore Drills* (simulacros de restauración) continuos aseguran que, pase lo que pase, los datos jamás se pierden.
* **Privacidad Extendida:** Protección 2FA/TOTP obligatoria, sesiones aisladas por dispositivo y rutinas de borrado seguro del caché local (Offline Drafts) evitan filtraciones si el médico comparte su computador en un box de atención.

---

## 5. Directrices de Diseño Sugeridas

* **Animaciones:** Scroll-triggered fades para las tarjetas Bento. El botón de CTA debe tener un efecto de "pulse" muy suave al hacer hover.
* **Imágenes:** No usar fotos de stock de médicos sonriendo. Usar capturas reales de la aplicación tratadas como piezas de arte, con sombras profundas y esquinas redondeadas.
* **Tipografía:** Inter para todo el cuerpo; para los titulares, una fuente Sans-Serif con mucho tracking (espaciado entre letras) para un look de "lujo tecnológico".
