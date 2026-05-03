# Auditoria de diseno y funcionamiento de PDFs medicos

Fecha de auditoria: 2026-05-01

## 1. Resumen ejecutivo

Nivel general de calidad visual: **Medio-bajo**.

El sistema genera PDFs funcionales con estructura basica, pero aun se siente mas como un reporte tecnico minimo que como documentacion clinica profesional. La vista imprimible de ficha clinica en frontend esta mas cuidada que los PDFs descargables del backend, por lo que la experiencia visual no es consistente.

Principales problemas detectados:

| ID | Problema | Severidad | Estado |
|---|---|---|---|
| PDF-01 | El pie de pagina puede crear paginas extra solo con numeracion. | Critica | Corregido en esta pasada |
| PDF-02 | No hay encabezado institucional con logo, clinica, direccion o contacto. | Alta | Mejora aplicada: nombre, logo, ID institucional y contacto desde ajustes |
| PDF-03 | Recetas, ordenes y derivaciones usan listas/texto plano en vez de layout clinico escaneable. | Alta | Mejora inicial aplicada |
| PDF-04 | Ficha e historial longitudinal tienen jerarquia visual plana y pocos bloques diferenciados. | Media | Mejora parcial aplicada en encabezado y bloques de tratamientos estructurados |
| PDF-05 | No hay QA visual automatizado sobre PDFs renderizados. | Media | Pendiente |
| PDF-06 | No se detectaron generadores dedicados para consentimiento informado o certificado medico. | Alta si estan dentro del alcance producto | Pendiente de confirmar |

Impacto:

- Medicos: lectura mas lenta de datos criticos como medicamentos, diagnosticos, alergias e indicaciones.
- Pacientes: documentos legibles, pero con baja senal institucional y menor percepcion de confianza.
- Administrativos: riesgo de imprimir hojas extra o archivar PDFs con nombres/estructura poco clara.

Prioridades:

1. Corregir paginacion y pies de pagina.
2. Unificar layout base de documento medico.
3. Redisenar receta/orden/derivacion como documentos focalizados.
4. Agregar pruebas visuales y funcionales con datos extremos.

## 2. Evaluacion visual general

Los PDFs usan `PDFKit`, hoja `LETTER`, margenes fijos, Helvetica base y separadores simples. Esto entrega legibilidad minima, pero poca identidad medica. No hay logo, datos de clinica, RUT institucional, direccion, telefono ni colores corporativos. La jerarquia existe, pero es plana: titulo de 18 pt, secciones de 12 pt y cuerpo de 10 pt.

Datos clinicos importantes como alergias, diagnosticos, medicamentos y signos vitales no tienen tratamiento visual diferenciado. En contenido largo, el texto fluye, pero faltan reglas finas de saltos, encabezados repetidos y agrupacion visual.

## 3. Matriz de hallazgos

| ID | Area | Hallazgo | Severidad | Impacto UX/Clinico | Evidencia esperada | Recomendacion | Prioridad |
|---|---|---|---|---|---|---|---|
| PDF-01 | Paginacion | El pie de pagina puede generar hojas extra solo con numeracion. | Critica | Impresion confusa y archivo poco profesional. | `tmp-encounter-long.pdf` declara mas paginas que el contenido real. | Renderizar footer dentro del margen inferior sin disparar nueva pagina y cubrirlo con test. | P0 |
| PDF-02 | Branding | No hay logo ni datos institucionales. | Alta | Baja confianza del documento medico. | Encabezados solo muestran titulo/fecha. | Parcialmente resuelto con header comun de clinica/contacto/ID; falta logo. | P0 |
| PDF-03 | Receta | Medicamentos estructurados se renderizan como linea con separadores. | Alta | Puede dificultar distinguir dosis, via, frecuencia y duracion. | `encounters-pdf.focused.renderers.ts`. | Usar tabla/bloques por medicamento. | P0 |
| PDF-04 | Estructura | La ficha completa mezcla campos lineales con poca diferenciacion administrativa/clinica. | Media | Lectura lenta en fichas largas. | `encounters-pdf.renderers.ts`. | Bloques visuales: paciente, atencion, clinica, tratamiento, firma. | P1 |
| PDF-05 | Contenido largo | No hay control explicito de mantener titulo con contenido. | Media | Titulos pueden quedar cerca del corte o separados. | `sectionTitle` solo revisa altura aproximada. | Agregar helpers `ensureSpace` y `keepTogether`. | P1 |
| PDF-06 | Tablas/listas | Examenes, derivaciones y medicamentos se concatenan. | Media | Baja escaneabilidad clinica. | `join(' | ')` y listas simples. | Implementar tabla/listas con filas, bordes suaves y wrap por celda. | P1 |
| PDF-07 | Accesibilidad | PDF no esta etiquetado semanticamente. | Baja/Media | Lectores de pantalla limitados. | `pdfinfo`: `Tagged: no`. | Evaluar tagged PDF si se requiere accesibilidad formal. | P2 |
| PDF-08 | Consistencia | Vista imprimible frontend y PDF backend tienen estilos distintos. | Media | Producto se siente desconectado. | `FichaClinicalRecord.tsx` vs PDFKit backend. | Definir tokens compartidos de documento. | P1 |
| PDF-09 | Alcance | No se encontraron generadores dedicados para certificados o consentimientos. | No evaluado/Alta | Puede indicar brecha funcional si se ofrece en producto. | Busqueda de rutas PDF. | Confirmar alcance e implementar plantillas. | P1 |
| PDF-10 | Nombre archivo | Historial backend usaba `historial-{id}.pdf`. | Baja | Archivo poco claro para administracion. | `patients-aux.controller.ts`. | Corregido: usar nombre paciente + tipo + fecha. | Aplicado |

## 4. Checklist de diseno y funcionamiento

| Criterio | Estado | Observacion | Recomendacion |
|---|---|---|---|
| PDF abre correctamente | Cumple | Buffers validos. | Mantener smoke tests. |
| Paginacion correcta | Cumple | Tests de regresion pasan para PDFs cortos y multipagina en ficha, documento focalizado e historial. | Mantener casos extremos y sumar validacion visual PNG. |
| Margenes consistentes | Parcial | Fijos y razonables, pero sin A4. | Definir Carta/A4 como decision de producto. |
| Branding | Parcial | Encabezado comun con nombre, logo, RUT/ID y contacto de clinica desde ajustes. | Validar calidad/tamano de logo con QA visual. |
| Legibilidad basica | Parcial | 10 pt legible, pero denso. | Mejorar interlineado y bloques. |
| Medicamentos claros | Parcial | Documentos focalizados ahora separan medicamentos estructurados en bloques; ficha completa aun concatena tratamientos. | Extender el patron a ficha completa e historial. |
| Contenido largo | Parcial | Fluye, pero sin QA visual robusto. | Fixtures extremos. |
| Blanco y negro | Parcial | Casi todo negro; alertas usan color. | Usar borde/patron ademas de color. |
| Caracteres especiales | Parcial | Acentos presentes en salida revisada. | Agregar test para `ñ`, `ug`, `°C`, `mg/dia`. |
| Consentimientos/certificados | No evaluado | No se encontro generador especifico. | Confirmar alcance. |

## 5. Problemas visuales esperados

- Paginas extra al final por la numeracion.
- Titulos separados de contenido en casos limite.
- Recetas dificiles de escanear si hay multiples medicamentos.
- Tablas inexistentes para datos naturalmente tabulares.
- Encabezados sin marca institucional.
- Firma solo como linea, sin registro profesional.
- Apariencia demasiado generica para documento medico oficial.

## 6. Recomendaciones priorizadas

### Inmediatas

- Corregir bug de paginas extra.
- Agregar prueba automatica de regresion para page count.
- Mejorar receta/orden/derivacion para que medicamentos y ordenes sean escaneables.

### Corto plazo

- Agregar logo/datos de clinica/profesional desde ajustes.
- Incorporar numero de registro profesional cuando exista en modelo.
- Diferenciar visualmente alertas, alergias, diagnosticos y tratamiento.
- Mejorar nombres de archivo.

### Mediano plazo

- Implementar snapshots visuales de PDFs convertidos a PNG.
- Crear fixtures extremos.
- Estandarizar plantillas para ficha, receta, orden, derivacion, consentimiento y certificado.

## 7. Propuesta de estructura ideal

### Receta medica

1. Encabezado institucional.
2. Datos compactos de paciente.
3. Fecha de emision.
4. Tabla de medicamentos: medicamento, principio activo, dosis, via, frecuencia, duracion, indicaciones.
5. Indicaciones generales.
6. Firma, nombre del profesional y registro.

### Ficha clinica

1. Encabezado institucional.
2. Paciente y atencion.
3. Motivo de consulta.
4. Anamnesis proxima.
5. Antecedentes.
6. Revision por sistemas.
7. Examen fisico.
8. Diagnosticos.
9. Tratamiento e indicaciones.
10. Evolucion/observaciones.
11. Firma y pie de pagina.

### Consentimiento informado

1. Encabezado institucional.
2. Identificacion del paciente y procedimiento.
3. Explicacion clara del procedimiento.
4. Riesgos.
5. Beneficios.
6. Alternativas.
7. Declaracion de aceptacion.
8. Firmas y fecha.
9. Numeracion y encabezado repetido si hay varias paginas.

### Certificado medico

1. Encabezado institucional.
2. Titulo.
3. Paciente.
4. Declaracion principal.
5. Periodo o condicion certificada.
6. Fecha de emision.
7. Profesional, firma, timbre y registro.

## 8. Criterios de aceptacion

- No debe haber texto cortado.
- No debe haber elementos solapados.
- No debe generar paginas extra.
- Debe imprimirse correctamente en hoja Carta y, si se define, A4.
- Debe mantener margenes consistentes.
- Debe abrir en Chrome, Preview/Acrobat y lectores comunes.
- Debe mostrar acentos y caracteres especiales.
- Debe manejar textos largos sin romper el layout.
- Debe mantener branding consistente.
- Debe ser legible en blanco y negro.
- Debe tener nombre de archivo claro.

## 9. Plan de QA visual

- Pruebas manuales: descargar, abrir, imprimir y revisar ficha, historial, receta, orden y derivacion.
- Pruebas automaticas: generar PDFs desde fixtures, validar cantidad de paginas, convertir a imagen y comparar snapshots.
- Datos extremos: nombres largos, multiples medicamentos, diagnosticos extensos, observaciones largas, campos vacios, firma/logo ausente.
- Pruebas de caracteres: acentos, `ñ`, `°C`, unidades, simbolos medicos.
- Revision clinica: al menos dos medicos y una persona administrativa revisando claridad y flujo real.

## 10. Registro de fixes de esta pasada

| Fecha | Fix | Archivos | Validacion | Estado |
|---|---|---|---|---|
| 2026-05-01 | Documento inicial de auditoria creado en raiz. | `PDF_DESIGN_AUDIT.md` | N/A | Aplicado |
| 2026-05-01 | Footer de numeracion extraido a helper compartido y ajustado para no disparar paginas nuevas al escribir en el margen inferior. | `backend/src/common/utils/pdf-page-footer.ts`, `backend/src/encounters/encounters-pdf.service.ts`, `backend/src/patients/patients-pdf.service.ts` | `npm --prefix backend run test -- --runInBand encounters-pdf.service.spec.ts patients-pdf.service.spec.ts`: OK. | Aplicado |
| 2026-05-01 | Tests de regresion agregados para contar paginas en PDFs cortos y largos, cubriendo ficha clinica, documento focalizado e historial longitudinal. | `backend/src/encounters/encounters-pdf.service.spec.ts`, `backend/src/patients/patients-pdf.service.spec.ts` | 10 tests PDF OK. | Aplicado |
| 2026-05-01 | Documentos focalizados mejorados visualmente: receta, ordenes y derivacion ahora separan secciones e items estructurados en bloques escaneables, con firma protegida contra cortes cercanos al fin de pagina. | `backend/src/encounters/encounters-pdf.focused.renderers.ts` | `npm --prefix backend run typecheck`: OK; tests PDF OK. | Aplicado |
| 2026-05-01 | Header institucional reutilizable agregado para PDFs, usando `clinic.name`, `clinic.address`, `clinic.phone` y `clinic.email` desde ajustes con fallback a Anamneo. | `backend/src/common/utils/pdf-document-layout.ts`, `backend/src/encounters/encounters-pdf.service.ts`, `backend/src/patients/patients-pdf.service.ts`, `backend/src/encounters/encounters.module.ts`, `backend/src/patients/patients.module.ts` | `npm --prefix backend run typecheck`: OK; tests PDF OK. | Aplicado |
| 2026-05-01 | Ficha clinica completa e historial longitudinal empiezan a reutilizar bloques escaneables para medicamentos, examenes y derivaciones estructuradas. | `backend/src/encounters/encounters-pdf.renderers.ts`, `backend/src/patients/patients-pdf.service.ts` | `npm --prefix backend run test -- --runInBand encounters-pdf.service.spec.ts patients-pdf.service.spec.ts`: OK. | Aplicado |
| 2026-05-01 | RUT/ID institucional agregado a ajustes y al encabezado PDF mediante `clinic.identifier`. | `backend/src/settings/settings.controller.ts`, `frontend/src/app/(dashboard)/ajustes/useAjustes.ts`, `frontend/src/app/(dashboard)/ajustes/ClinicTab.tsx`, `backend/src/common/utils/pdf-document-layout.ts` | Backend/frontend typecheck OK; `ajustes.test.tsx` OK. | Aplicado |
| 2026-05-01 | Nombre de archivo del historial longitudinal cambiado de `historial-{uuid}.pdf` a `{Paciente} - Historial clinico - {fecha}.pdf`. | `backend/src/patients/patients-pdf.service.ts`, `backend/src/patients/patients-pdf-helpers.ts`, `backend/src/patients/patients-aux.controller.ts` | Tests PDF OK, incluyendo sanitizacion de nombre. | Aplicado |
| 2026-05-01 | Soporte de logo institucional por URL publica agregado a ajustes y render PDF; si el logo no carga, el PDF conserva el encabezado textual. | `backend/src/settings/settings.controller.ts`, `frontend/src/app/(dashboard)/ajustes/ClinicTab.tsx`, `frontend/src/app/(dashboard)/ajustes/useAjustesClinic.ts`, `backend/src/common/utils/pdf-document-layout.ts`, `backend/src/encounters/encounters-pdf.service.ts`, `backend/src/patients/patients-pdf.service.ts` | Backend/frontend typecheck OK; tests PDF y `ajustes.test.tsx` OK. | Aplicado |
| 2026-05-01 | Refactor pequeno de ajustes: la logica de centro/correo/preview salio de `useAjustes.ts` a `useAjustesClinic.ts`, dejando el hook principal bajo 300 lineas. | `frontend/src/app/(dashboard)/ajustes/useAjustes.ts`, `frontend/src/app/(dashboard)/ajustes/useAjustesClinic.ts` | `useAjustes.ts` queda en 164 lineas; frontend typecheck y `ajustes.test.tsx` OK. | Aplicado |
| 2026-05-01 | Prueba visual automatica inicial agregada: genera un PDF focalizado, lo renderiza a PNG con `pdftoppm` y valida que el snapshot raster exista y pese mas de 1 KB. | `backend/src/encounters/encounters-pdf.service.spec.ts` | Tests PDF OK. | Aplicado |

## 11. Pendientes vivos

- Confirmar visualmente los PDFs focalizados con datos reales despues de la mejora inicial.
- Confirmar visualmente ficha completa e historial longitudinal despues de extender bloques estructurados.
- Agregar datos profesionales avanzados al encabezado/firma.
- Confirmar alcance real de consentimientos informados y certificados medicos.
- Agregar QA visual automatizado con render PNG.
