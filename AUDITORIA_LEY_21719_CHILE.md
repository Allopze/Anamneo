# Auditoria de cumplimiento Ley 21.719 Chile

Fecha de auditoria: 2026-05-22 (actualizada 2026-05-23 con verificacion contra texto oficial, auditoria tecnica del repo, y ejecucion del roadmap Olas 0-4)
Repositorio auditado: Anamneo
Alcance: revision documental y tecnica del codigo fuente disponible en este repositorio. No es certificacion legal ni reemplaza la revision de un abogado chileno especialista en proteccion de datos y derecho sanitario.

Verificacion del texto legal: el 2026-05-23 se descargo y leyo integramente la version oficial de la Ley 21.719 publicada por BCN, version "Con Vigencia Diferida por Fecha De: 01-DIC-2026" (idNorma 1209272, idVersion 2026-12-01, 34 paginas). El mapeo articulo por articulo se basa en ese texto, no en resumenes secundarios.

Auditoria tecnica del repo: el 2026-05-23 se ejecuto verificacion directa sobre el codigo fuente del repositorio (schema.prisma, servicios de auth, audit, regulatory export/purge, encryption, Sentry, politica seeded, doc data-privacy-and-compliance) para validar punto por punto las afirmaciones de esta auditoria. Los hallazgos se consolidan en la seccion "Auditoria tecnica del repositorio - hallazgos verificados".

Ejecucion del roadmap: el 2026-05-23 se ejecutaron las olas 0 a 4 del plan documentado en `/home/allopze/.claude/plans/crea-un-plan-para-logical-hearth.md`. Los cambios concretos al repo y el estado actualizado de cada brecha P0 se consolidan en la seccion "Estado tras ejecucion del roadmap Olas 0-4 (2026-05-23)" al final de este documento.

## Resumen ejecutivo

Anamneo tiene una base tecnica solida para operar con datos clinicos: autenticacion por cookies HttpOnly, 2FA, bloqueo de login, revocacion de sesiones, CSRF, autorizacion por rol y medico efectivo, cifrado AES-256-GCM de secciones clinicas en produccion, exigencia de cifrado del filesystem, auditoria con cadena de integridad SHA-256 verificable, export regulatorio y purge regulatorio admin-only, documentos legales versionables y scrubbing de PHI en logs/Sentry. **Todo verificado contra el codigo el 2026-05-23** (ver seccion "Auditoria tecnica del repositorio").

La app NO esta lista para tratar datos reales bajo regimen de la Ley 21.719. Los hallazgos criticos confirmados en la auditoria tecnica son:

1. **La politica de privacidad publicada por el seed** (`backend/prisma/seed.ts:74`) lleva una nota literal que dice *"Documento base para entornos de desarrollo y pruebas; requiere revision legal antes de produccion"*. No cumple ninguno de los 12 elementos del Art 14 ter.
2. **El `InformedConsent` se otorga por un User del sistema, no por el titular** (`schema.prisma:628`). Estructuralmente no satisface el Art 12 (manifestacion de voluntad del titular).
3. **Datos identificatorios del paciente (RUT, nombre, telefono, email, domicilio) no estan cifrados a nivel aplicacion**. Dependen exclusivamente del cifrado de filesystem.
4. **Los snapshots pre-purge se escriben en claro** en `runtime/data/purges/` con PHI desencriptada y adjuntos.
5. **Faltan, sin equivocos en codigo**: entidad de solicitudes del titular, flag de bloqueo temporal (Art 8 ter), opt-out a analitica (Art 8), representante legal y consentimiento parental para NNA (Art 16 quater), DPIA (Art 15 ter), registro de actividades de tratamiento (Art 14 ter), contratos firmados con subencargados (Art 15 bis), DPO designado (Art 50), inventario de transferencias internacionales (Arts 27-28), cifrado app-level para adjuntos y snapshots, UI de derechos del titular y plantillas de respuesta.
6. **El doc `docs/data-privacy-and-compliance.md` esta desactualizado y cita articulos incorrectos** (Art 13 en vez de Art 5 para acceso; Art 29 en vez de Art 14 sexies para brechas).

Importante sobre fechas: la version oficial de la Ley 21.719 en Ley Chile/BCN indica "Tipo Version: Con Vigencia Diferida por Fecha De: 01-DIC-2026" y sus disposiciones transitorias fijan la entrada en vigencia el primer dia del mes vigesimo cuarto posterior a la publicacion en el Diario Oficial. Por tanto, la fecha legal de entrada en vigencia es el 1 de diciembre de 2026. El 2 de diciembre de 2026 puede usarse como hito operativo interno de "todo debe estar funcionando bajo regimen".

## Fuentes legales consultadas

- Ley Chile / Biblioteca del Congreso Nacional, Ley 21.719, "Regula la proteccion y el tratamiento de los datos personales y crea la Agencia de Proteccion de Datos Personales": https://www.bcn.cl/leychile/navegar?i=1209272
- Version imprimible Ley Chile usada para verificacion: https://www.leychile.cl/leychile/Navegar/imprimir?idNorma=1209272&idVersion=2026-12-01
- PDF oficial exportado desde Ley Chile, Ley 21.719, documento generado el 22-May-2026, URL corta indicada por BCN: https://bcn.cl/gJo3hf

Articulos efectivamente leidos y mapeados: 1, 1 bis, 2 (definiciones a-z), 3 (principios a-h), 4, 5, 6, 7, 8, 8 bis, 8 ter, 9, 10, 11, 12, 13, 14, 14 bis, 14 ter, 14 quater, 14 quinquies, 14 sexies, 14 septies, 15, 15 bis, 15 ter, 16, 16 bis, 16 ter, 16 quater, 16 quinquies, 16 sexies, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 30 bis, 33, 34, 34 bis, 34 ter, 34 quater, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55 y disposiciones transitorias primera a octava.

Nota sobre estructura del articulado: la Ley 21.719 modifica la Ley 19.628 sustituyendo titulos completos. La numeracion citada corresponde al texto modificado de la Ley 19.628 segun la version BCN con vigencia 01-DIC-2026, que es la que regira a partir de esa fecha.

## Supuestos de cumplimiento

- La clinica usuaria debe ser tratada, por defecto, como responsable del tratamiento cuando decide finalidad y medios del tratamiento clinico.
- El operador tecnico de la instancia Anamneo debe ser tratado, por defecto, como encargado o tercero mandatario cuando procesa datos por cuenta de la clinica.
- El modelo productivo documentado es `single-clinic`: una instancia, una base de datos, un volumen de uploads y backups por clinica.
- La informacion de salud registrada en Anamneo es dato personal sensible bajo la Ley 21.719.
- Esta auditoria revisa el repo; no verifica contratos reales, configuracion real de hosting, ubicacion de proveedores, respaldos productivos ni procedimientos internos de la clinica.

## Evidencia tecnica relevante en el repo

- Datos y categorias: `backend/prisma/schema.prisma`, `docs/data-model.md`, `docs/data-privacy-and-compliance.md`.
- Seguridad de arranque: `backend/src/main.helpers.ts`.
- Bootstrap backend, Helmet, CORS, CSRF, tracing: `backend/src/main.bootstrap.ts`, `backend/src/common/middleware/csrf.middleware.ts`.
- Autenticacion y sesiones: `backend/src/auth/*`, `backend/src/users/users-session.service.ts`, `backend/src/auth/strategies/jwt.strategy.ts`.
- Cifrado PHI en secciones clinicas: `backend/src/common/utils/field-crypto.ts`, `backend/src/encounters/encounters-sanitize.ts`.
- Auditoria e integridad: `backend/src/audit/audit.service.ts`, `backend/src/audit/audit-catalog.ts`, `backend/src/audit/audit-helpers.ts`.
- Export y purge regulatorio: `backend/src/patients/patients-regulatory.controller.ts`, `backend/src/patients/patients-regulatory-export.service.ts`, `backend/src/patients/patients-regulatory-purge.service.ts`.
- Politicas legales versionables: `shared/legal-contract.ts`, `backend/src/legal/legal.service.ts`, `backend/src/legal/legal.controller.ts`, `frontend/src/app/politica-de-privacidad/page.tsx`, `frontend/src/app/terminos-y-condiciones/page.tsx`.
- Consentimientos clinicos: `backend/src/consents/consents.service.ts`, `backend/src/consents/consents.controller.ts`.
- Adjuntos: `backend/src/attachments/*`.
- Logs y Sentry: `backend/src/common/utils/phi-scrub.ts`, `backend/src/instrument.ts`, `docs/observability-slos.md`.
- Operacion, backups e incidentes: `docs/operational-procedures.md`, `docs/incident-runbooks.md`, `docs/deployment-and-release.md`, `docs/environment.md`.
- Modo offline/local: `frontend/src/lib/offline-queue.ts`, `frontend/src/stores/privacy-settings-store.ts`.

## Cotejo articulo por articulo (texto oficial vs estado del repo)

Esta seccion mapea cada articulo aplicable de la Ley 21.719 a la situacion concreta de Anamneo. "Estado" sigue la convencion: CUMPLE (la app ya cumple, sin perjuicio de evidencia documental complementaria), PARCIAL (cumple en lo tecnico pero falta capa legal/operativa), PENDIENTE (brecha real, requiere desarrollo o decision), NO APLICA TECNICO (la obligacion es de la clinica como responsable, no del software).

| Articulo | Materia | Obligacion clave | Estado | Observacion |
|---|---|---|---|---|
| 1 | Objeto y ambito | Tratamiento de datos de personas naturales conforme art 19 N 4 CPR | PARCIAL | Anamneo trata datos sanitarios de personas naturales. Falta declaracion formal en politica de privacidad. |
| 1 bis | Ambito territorial | Aplica si responsable/mandatario establecido en Chile o si trata datos de titulares en Chile | CUMPLE TECNICO | Despliegue single-clinic en Chile cae integramente bajo la ley. |
| 2 | Definiciones | Define dato sensible (incluye datos de salud, perfil biologico, biometricos), seudonimizacion, anonimizacion, consentimiento, tercero mandatario, etc. | INFORMATIVO | Las secciones clinicas de Anamneo son dato personal sensible por definicion legal. |
| 3 | Principios (licitud, finalidad, proporcionalidad, calidad, responsabilidad, seguridad, transparencia, confidencialidad) | Acreditar cumplimiento de los 8 principios | PARCIAL | Tecnicamente respaldados, pero falta evidencia documental (registro de actividades, politica vigente, matriz finalidad/base legal). |
| 4 | Derechos del titular | Acceso, rectificacion, supresion, oposicion, portabilidad y bloqueo. Personales, intransferibles, irrenunciables. | PARCIAL | Export regulatorio y soft delete cubren parte. Faltan flujos formales para oposicion (art 8), bloqueo (art 8 ter) y portabilidad (art 9). |
| 5 | Derecho de acceso | Confirmacion + datos tratados, origen, finalidad, destinatarios, plazo, logica de tratamiento automatizado | PARCIAL | `PatientsRegulatoryExportService` entrega data + adjuntos. Falta incluir formalmente: destinatarios, periodo, logica automatizada cuando aplique. |
| 6 | Derecho de rectificacion | Obligacion de comunicar la rectificacion a destinatarios cedidos | PARCIAL | App permite edicion + auditoria. Falta workflow de comunicacion a terceros cuando hubo cesion. |
| 7 | Derecho de supresion | Lista 6 causales + 6 excepciones (incluye "interes publico en salud publica" y "fines historicos/cientificos") | PARCIAL ALTO | Purge regulatorio existe; las excepciones legales sanitarias justifican retencion. Falta documentar legalmente las causales de denegacion. |
| 8 | Derecho de oposicion | Aplica a interes legitimo, marketing, fuentes publicas | PENDIENTE | No hay `objections` ni `statisticsOptOut` por paciente/finalidad. Marketing no aplica a Anamneo pero analitica si. |
| 8 bis | Decisiones automatizadas y perfilamiento | Derecho a no ser objeto de decisiones automatizadas con efectos significativos. Excepcion: contrato, consentimiento, ley con salvaguardas. | NO APLICA HOY | Anamneo no usa decisiones automatizadas hoy. Si se incorpora IA clinica habra que cumplir: informacion, intervencion humana, revision. |
| 8 ter | Bloqueo temporal del tratamiento | Suspender tratamiento mientras se resuelve rectificacion/supresion/oposicion. Plazo de respuesta 2 dias habiles (art 41). | PENDIENTE | No existe estado/flag de bloqueo en `Patient` ni en `PatientDataRequest`. Brecha P0. |
| 9 | Portabilidad | Formato electronico estructurado, generico, uso comun, automatizado | PARCIAL | El ZIP regulatorio incluye `data.json` que puede satisfacerlo. Falta endpoint/flujo accesible al titular y documentacion del esquema portable. |
| 10 | Forma y medios de ejercer derechos | Mecanismos sencillos, gratuitos (acceso 1 vez por trimestre gratis; rectificacion, supresion y oposicion siempre gratis) | PENDIENTE | No hay UI/canal publico del titular. Hoy se ejerce admin-only desde back office. |
| 11 | Procedimiento ante el responsable | Acuse de recibo, plazo 30 dias corridos + prorroga 30 dias, respuesta escrita, indicar reclamacion ante Agencia | PENDIENTE | Falta tracking, plantillas, plazos automatizados y registro probatorio de respuesta. |
| 12 | Regla general - consentimiento | Libre, informado, especifico, previo, inequivoco. Revocable. Carga de prueba en el responsable. | PARCIAL | `UserLegalAcceptance` cubre usuarios. Para pacientes hay `InformedConsent` clinico pero no un consentimiento separado y versionado de tratamiento de datos personales. |
| 13 | Otras fuentes de licitud | Obligacion legal, contrato, interes legitimo, ejercicio de derechos | PARCIAL | El tratamiento de salud puede ampararse en obligacion legal/ejercicio de derechos sanitarios, pero falta documentar la base legal por finalidad. |
| 14 | Obligaciones del responsable | Informar, recolectar de fuentes licitas, comunicar exacto, suprimir/anonimizar datos no usados, deberes generales | PARCIAL | DTOs y validaciones limitan ingreso. Falta procedimiento de supresion/anonimizacion cuando un caso no llega a ejecucion. |
| 14 bis | Deber de secreto/confidencialidad | Subsiste tras concluir la relacion. Aplicable a dependientes. | PARCIAL | Tecnicamente respaldado con guards y minimizacion. Falta clausula en contratos y capacitacion documentada. |
| 14 ter | Deber de informacion y transparencia | Lista 12 elementos a publicar permanentemente: politica, responsable, encargado de prevencion, dominio, categorias, destinatarios, finalidad, base legal, seguridad, derechos, reclamo ante Agencia, transferencias, periodo, fuente, decisiones automatizadas | PENDIENTE | La pagina `/politica-de-privacidad` existe pero el contenido publicado debe verificarse contra los 12 puntos del art 14 ter. Brecha P0. |
| 14 quater | Privacy by design / by default | Medidas tecnicas y organizativas desde el diseno; por defecto solo datos estrictamente necesarios | PARCIAL ALTO | Arquitectura single-clinic, same-origin, cifrado de secciones clinicas y modo equipo compartido cubren el espiritu. Falta DPIA formal (art 15 ter). |
| 14 quinquies | Medidas de seguridad | Lista explicita: a) seudonimizacion y cifrado, b) confidencialidad/integridad/disponibilidad/resiliencia, c) restauracion rapida tras incidente, d) verificacion/evaluacion regulares | PARCIAL ALTO | a) cifrado de secciones clinicas SI, seudonimizacion en analitica parcial. b) SI. c) backups + restore drills SI. d) `audit:integrity:verify` existe pero falta cadencia formal documentada y reportada. |
| 14 sexies | Reporte de vulneraciones | Reportar a la Agencia "sin dilaciones indebidas" cuando exista "riesgo razonable". Comunicar a titulares cuando se trate de datos sensibles, datos de menores de 14 anos o datos financieros. Registro interno de vulneraciones. | PARCIAL | Existen runbooks de incidentes. Falta: plantilla de notificacion a la Agencia, plantilla a titulares en lenguaje claro, registro formal de vulneraciones, criterios de "riesgo razonable" predefinidos. |
| 14 septies | Estandares diferenciados | La Agencia diferenciara por tamano y categoria de datos. | INFORMATIVO | Anamneo trata datos sensibles - estandar mas exigente. |
| 15 | Cesion de datos | Por escrito o medio electronico idoneo, identificando partes, datos, finalidad. El cesionario es responsable. | NO APLICA HOY | Anamneo no cede datos a terceros. Si se incorporan integraciones (laboratorios, isapres, derivaciones) debera implementarse. |
| 15 bis | Tratamiento por encargado | CONTRATO ESCRITO obligatorio con: objeto, duracion, finalidad, tipo de datos, categorias de titulares, derechos y obligaciones. Encargado solo trata segun instrucciones. Solidariamente responsable. Devolucion/supresion al terminar. | PENDIENTE | DPA referencial existe en `docs/data-privacy-and-compliance.md` pero no es contrato firmado con la clinica ni con subencargados (Cloudflare, Sentry, SMTP). Brecha P0. |
| 15 ter | Evaluacion de impacto en proteccion de datos (DPIA) | OBLIGATORIA cuando hay alto riesgo. Casos taxativos: a) decisiones automatizadas/perfilamiento, b) tratamiento masivo o gran escala, c) monitoreo de zonas publicas, d) DATOS SENSIBLES Y ESPECIALMENTE PROTEGIDOS en hipotesis de excepcion del consentimiento. | PENDIENTE | Anamneo cae en (d) directamente: datos de salud tratados bajo excepciones del art 16 bis. La DPIA no se ha realizado ni esta en repo. Brecha P0 nueva detectada por verificacion contra texto oficial. |
| 16 | Regla general datos sensibles | Consentimiento EXPRESO por declaracion escrita/verbal o medio electronico equivalente. Excepciones (a-f) incluyen salvaguardar vida/salud cuando hay impedimento, fines de medicina preventiva/laboral, autorizacion legal. | PARCIAL | La excepcion (e) del art 16 (medicina preventiva, diagnostico, asistencia sanitaria) cubre el caso clinico tipico de Anamneo. Falta dejarlo declarado expresamente como base legal en la politica de privacidad. |
| 16 bis | Datos de salud y perfil biologico | SOLO se pueden tratar para fines previstos por LEYES ESPECIALES EN MATERIA SANITARIA. Excepciones: vida/integridad, alerta sanitaria, investigacion, defensa de derechos, medicina preventiva/laboral, ley que lo autorice expresamente. PROHIBE almacenar muestras biologicas asociadas a titular identificable salvo ley expresa. | PARCIAL ALTO | El amparo legal especifico se ancla en Ley 20.584 y normativa MINSAL sobre ficha clinica. Anamneo no almacena muestras biologicas. Importante: aclarar en politica y registro de actividades la ley sanitaria especifica que justifica cada finalidad. |
| 16 ter | Datos biometricos | Requieren informar: sistema usado, finalidad especifica, periodo, forma de ejercer derechos | NO APLICA HOY | Anamneo no procesa biometria. |
| 16 quater | Datos de ninos, ninas y adolescentes | Ninos (<14): consentimiento de padres/representante. Adolescentes (14-18): reglas adultas, salvo datos sensibles de menores de 16 que requieren padres. Obligacion especial de proteccion en establecimientos. | PENDIENTE | Anamneo trata datos de menores en contexto clinico. Falta: campo de representante legal/tutor, captura de consentimiento parental para sensibles <16, flujo diferenciado. Brecha P0 nueva detectada. |
| 16 quinquies | Fines historicos, estadisticos, cientificos | Interes legitimo si hay medidas adecuadas; anonimizar antes de publicar | PARCIAL | Analitica clinica de Anamneo es para uso interno del medico tratante (no investigacion). Si se habilita analitica para fines cientificos, requiere anonimizacion. |
| 16 sexies | Geolocalizacion | Sometido a las mismas reglas de licitud (arts 12 y 13). Informar tipo, finalidad, duracion, cesion. | NO APLICA HOY | Anamneo no recolecta geolocalizacion. |
| 17-19 | Datos de obligaciones financieras | Reglas especificas para DICOM/Equifax | NO APLICA | Anamneo no trata datos financieros. |
| 20-26 | Tratamiento por organos publicos | Regimen especifico para organos del Estado | NO APLICA DIRECTO | Si una clinica publica usa Anamneo, debera complementar con este titulo. |
| 27 | Transferencia internacional - regla general | Licita si: pais con nivel adecuado, clausulas contractuales/normas corporativas, modelo de cumplimiento. Excepciones: consentimiento expreso para transferencia especifica, salud/medicina urgente, contrato. | PARCIAL | El tratamiento de datos por Cloudflare, Sentry y SMTP implica transferencia internacional. Falta inventario formal, paises, garantias contractuales aprobadas. |
| 28 | Determinacion de paises adecuados | La Agencia define paises adecuados. Garantias adecuadas: principios y derechos exigibles. | PENDIENTE | Sin lista oficial aun (la Agencia se constituye). Mientras tanto, asegurar consentimiento o clausulas contractuales con cada proveedor extranjero. |
| 29 | Fiscalizacion transferencias | La Agencia puede suspender transferencias internacionales | INFORMATIVO | Riesgo operativo: una suspension afectaria Cloudflare/Sentry/SMTP. |
| 30 a 32 | Agencia, Consejo Directivo, funciones | Crea APDP, fija funciones | INFORMATIVO | Anamneo debera registrarse, responder requerimientos, eventualmente certificar modelo. |
| 33 | Regimen general de responsabilidad | Quien infrinja principios o derechos sera sancionado | INFORMATIVO | Aplica a la clinica y solidariamente al encargado en caso de uso fuera de instrucciones. |
| 34 / 34 bis / 34 ter / 34 quater | Tipificacion: leves, graves, gravisimas | Lista taxativa. Ejemplo gravisimas: tratar fraudulentamente, ceder a sabiendas datos sensibles, omitir notificacion de vulneraciones que afecten confidencialidad. | INFORMATIVO | Brechas tipicas del software clinico aterrizan en: graves (vulnerar deber de secreto art 14 bis, infringir seguridad art 14 quinquies, omitir registros de vulneraciones, transferencia internacional sin garantias) y gravisimas (tratar datos sensibles sin amparo, omitir notificacion de brecha deliberadamente, datos de NNA en contravencion). |
| 35 | Sanciones | Leves: amonestacion o multa hasta 5.000 UTM. Graves: hasta 10.000 UTM. Gravisimas: hasta 20.000 UTM. Reincidencia hasta 3x. Empresas no PYME reincidentes en graves/gravisimas: 2% o 4% de ingresos anuales. | INFORMATIVO | A valor UTM aprox 2026, una gravisima maxima ronda los CLP 1.300 millones (cuantificacion referencial). |
| 36 | Atenuantes y agravantes | Atenuantes: reparacion, colaboracion, autodenuncia, no tener sanciones previas, cumplimiento diligente certificado (art 51). Agravantes: reincidencia, caracter continuado, poner en riesgo. | INFORMATIVO | El modelo de prevencion certificado (art 49-51) opera como atenuante formal. |
| 37 | Determinacion de multas | 8 criterios: gravedad, falta de diligencia, perjuicio (cantidad de titulares afectados), beneficio economico, datos sensibles o NNA, capacidad economica, sanciones previas, atenuantes/agravantes. | INFORMATIVO | Datos sensibles y NNA agravan automaticamente. |
| 38 | Sanciones accesorias | Suspension de operaciones de tratamiento por hasta 30 dias, prorrogable. | INFORMATIVO | Riesgo operacional severo: suspende la operacion clinica. |
| 39 | Registro Nacional de Sanciones | Publico, gratuito, anotaciones por 5 anos. Tambien anota responsables con modelo de prevencion certificado. | INFORMATIVO | Una sancion sera publica y trazable por 5 anos. |
| 40 | Prescripcion | Infracciones prescriben en 4 anos, sanciones en 3 anos. | INFORMATIVO | Conservar evidencia de cumplimiento al menos 4 anos. |
| 41 | Procedimiento de tutela de derechos | Reclamo ante la Agencia. Suspension del tratamiento durante reclamacion (peticion fundada). Plazo de resolucion 6 meses. Bloqueo temporal en 3 dias habiles. | PENDIENTE | Operativamente requiere proceso de respuesta a la Agencia. |
| 42 | Procedimiento sancionatorio | Inicio de oficio o por reclamacion. Formulacion de cargos, 15 dias habiles para descargos, termino probatorio 10 dias, resolucion fundada. Maximo 6 meses. | INFORMATIVO | Preparar plantillas y responsable. |
| 43 | Reclamacion judicial | Ante Corte de Apelaciones, 15 dias habiles. | INFORMATIVO | Defensa legal externa. |
| 44 | Responsabilidad del jefe superior del organo publico | Multa 20-50% remuneracion mensual; duplicacion + suspension si persiste; sensibles 50% + suspension 30 dias | NO APLICA | Aplica a clinicas publicas. |
| 45 | Responsabilidad del funcionario | Sumario administrativo si hay responsabilidad individual | NO APLICA | Aplica a funcionarios publicos. |
| 46 | Deber de reserva de funcionarios | Confidencialidad especial sensibles | NO APLICA | Aplica a organos publicos. |
| 47 | Responsabilidad civil | Indemnizacion por DANO PATRIMONIAL Y EXTRAPATRIMONIAL. Acciones civiles prescriben en 5 anos desde resolucion firme. | INFORMATIVO | El dano moral por filtracion de datos clinicos es directamente indemnizable. |
| 48 | Prevencion de infracciones | OBLIGATORIO: responsables deben adoptar acciones para prevenir infracciones leves, graves, gravisimas. | PARCIAL | Hay controles tecnicos. Falta formalizar el "programa de prevencion" del art 48 como tal. |
| 49 | Modelo de prevencion de infracciones | VOLUNTARIO. Si se adopta, debe contener 7 elementos: a) DPO designado, b) facultades del DPO, c) inventario y categorizacion, d) actividades/procesos con riesgo, e) protocolos, f) reporte interno + reporte de brechas art 14 sexies, g) sanciones internas. Debe constar en contratos de trabajo o reglamento interno. | PENDIENTE | Crear el modelo aporta atenuante (art 36.5) y permite certificacion (art 51). Recomendado para Anamneo dada la sensibilidad de los datos. |
| 50 | Delegado de proteccion de datos (DPO) | Designado por la maxima autoridad. Autonomia. PYMES: el dueno puede asumirlo. Funciones tipicas: asesor, supervisor, formacion, contacto con la Agencia. | PENDIENTE | Designar formalmente, publicar contacto, dotar de recursos. Brecha P0. |
| 51 | Certificacion del modelo | La Agencia certifica modelos validos. Inscripcion en Registro Nacional. Vigencia 3 anos. | INFORMATIVO | Camino futuro de madurez. |
| 52 a 53 | Vigencia y revocacion del certificado | Vigencia 3 anos; revocacion por incumplimiento | INFORMATIVO | - |
| 54 a 55 | Tratamiento por Congreso, Poder Judicial, organos autonomos | Regimen especial | NO APLICA | - |
| Transitorio 1 | Entrada en vigencia | Primer dia del mes vigesimo cuarto posterior a publicacion = 1-DIC-2026 | CRITICO | Fecha confirmada. |
| Transitorio 2 | Reglamentos | Dentro de 6 meses de publicada | INFORMATIVO | Reglamentos podrian agregar requisitos especificos. |
| Transitorio 3 | Registro Civil debe eliminar registro de bancos de datos | 60 dias antes de vigencia | NO APLICA | - |
| Transitorio 4 | Designacion del Consejo Directivo de la Agencia | 60 dias antes de vigencia | INFORMATIVO | La Agencia estara operativa al 01-DIC-2026. |
| Transitorio 6 | PYMES, primeros 12 meses | Solo amonestacion escrita para empresas de menor tamano (Ley 20.416) | RELEVANTE | Si Anamneo opera con clinicas calificadas como PYME, el primer ano post-vigencia hay regimen de amonestacion. No exime de la obligacion sustantiva. |

### Discrepancias y correcciones detectadas al cotejar contra el texto oficial

La auditoria inicial omitia o trataba en bloque varios articulos que tienen impacto directo en el roadmap de Anamneo. Tras la verificacion contra el texto oficial:

1. **Articulo 15 ter (DPIA)**: la auditoria original lo mencionaba lateralmente como "DPIA/evaluacion de riesgos" en privacy by design. El texto legal lo hace OBLIGATORIO para datos sensibles tratados bajo excepcion del consentimiento (causal d). Anamneo cae en esa causal. Promover a brecha P0.
2. **Articulo 16 quater (NNA)**: la auditoria original no abordaba menores. La ley exige consentimiento de padres/representantes para menores de 14, y para datos sensibles de menores de 16. Anamneo trata datos de pacientes pediatricos sin distincion etaria formal en el modelo. Nueva brecha P0.
3. **Articulo 16 bis (salud)**: el texto legal exige que el tratamiento de datos de salud se ampare en LEY ESPECIAL SANITARIA. La auditoria debe declarar explicitamente que Ley 20.584 y normas MINSAL son el ancla legal.
4. **Articulo 14 sexies (brechas)**: la ley fija un estandar mas exigente que un runbook generico. Requiere reporte a la Agencia "sin dilaciones indebidas" cuando exista "riesgo razonable", y comunicacion a titulares cuando se trate de datos sensibles. Anamneo trata exclusivamente datos sensibles, por lo que toda brecha verificable activa el deber de notificar a titulares.
5. **Articulo 14 ter (12 items en politica)**: la politica publicada debe verificarse punto por punto contra los 12 elementos del articulo. No basta con "politica accesible".
6. **Articulo 35 (cuantia de multas)**: la auditoria no cuantificaba el riesgo sancionatorio. Multas hasta 20.000 UTM por infraccion gravisima, escalable por reincidencia.
7. **Articulo 47 (indemnizacion civil)**: la auditoria no contemplaba la accion civil. La ley reconoce expresamente dano extrapatrimonial (moral), lo que en datos clinicos es altamente probable y cuantificable judicialmente.
8. **Articulo 48 (prevencion obligatoria)**: la prevencion de infracciones es OBLIGATORIA por mandato legal, no solo el modelo del art 49 (voluntario). La auditoria los confundia.
9. **Articulo 11 (plazos)**: respuesta al titular es 30 DIAS CORRIDOS (no habiles), prorrogable por 30 corridos adicionales. Bloqueo temporal: 2 dias habiles (incongruencia con art 41 que dice 3 dias - aplica el plazo de bloqueo art 41 letra final).
10. **Articulo 8 bis (decisiones automatizadas)**: si en el futuro Anamneo incorpora IA clinica o triage automatizado, activa derecho a explicacion, intervencion humana y revision. Diseno preventivo necesario.
11. **Articulo 16 bis prohibicion**: prohibe almacenar muestras biologicas asociadas a titular identificable salvo ley expresa. Anamneo no lo hace, pero debe quedar consignado como decision arquitectonica.

### Articulos del texto oficial NO mapeados en esta auditoria

Para completitud y futura revision: articulos 30 ter a 30 nonies (gobernanza interna de la Agencia), 31 (coordinacion con Consejo para la Transparencia), 32 (personal de la Agencia) no aplican a Anamneo directamente.

## Auditoria tecnica del repositorio - hallazgos verificados (2026-05-23)

Esta seccion documenta el resultado de inspeccionar directamente el codigo fuente para validar cada afirmacion de la auditoria. Cada item incluye la cita al archivo y, cuando corresponde, el numero de linea.

### Claims tecnicos confirmados

| Afirmacion | Estado | Evidencia |
|---|---|---|
| Cookies `HttpOnly`, `SameSite=strict`, `Secure` en produccion | CONFIRMADO | `backend/src/auth/auth.controller.ts:26-28` y `:68` |
| Lockout persistente tras intentos fallidos | CONFIRMADO | `backend/prisma/schema.prisma:576-586` (modelo `LoginAttempt` con `failedAttempts`, `lockedUntil`) + `backend/src/auth/auth-login-flow.ts:56-74` |
| Sesiones revocables (`UserSession`) y refresh token versionado | CONFIRMADO | `schema.prisma:522-536` (`UserSession` con `revokedAt`) + `schema.prisma:27` (`User.refreshTokenVersion`) |
| 2FA TOTP opcional con recovery codes | CONFIRMADO | `schema.prisma:24-26` (`totpSecret`, `totpEnabled`, `totpRecoveryCodes`) + `backend/src/auth/auth-2fa-flow.ts` y `auth-recovery-codes.ts` |
| CSRF middleware activo | CONFIRMADO | `backend/src/common/middleware/csrf.middleware.ts` referenciado en `backend/src/main.bootstrap.ts:17,137` |
| Helmet y CORS allowlist | CONFIRMADO | `main.bootstrap.ts:5,115` (helmet) y `:140-147` (CORS por `CORS_ORIGIN` split por coma) |
| ENCRYPTION_KEY obligatorio en produccion (64 hex chars) | CONFIRMADO | `backend/src/main.helpers.ts:110-123` |
| ENCRYPTION_AT_REST_CONFIRMED=true obligatorio en produccion | CONFIRMADO | `main.helpers.ts:103-108` |
| SETTINGS_ENCRYPTION_KEY/JWT/BOOTSTRAP_TOKEN gates en produccion | CONFIRMADO | `main.helpers.ts:52-99` (longitud minima 32, no placeholders) |
| Single-clinic enforced en produccion | CONFIRMADO | `main.helpers.ts:40-50` (rechaza despliegue distinto a `single-clinic`) |
| TRUST_PROXY obligatorio en produccion | CONFIRMADO | `main.helpers.ts:125-133` |
| Cifrado AES-256-GCM con prefijo `enc:v1:` | CONFIRMADO | `backend/src/common/utils/field-crypto.ts:1-50` |
| Cifrado aplicado a EncounterSection.data | CONFIRMADO | `backend/src/encounters/encounters-sanitize.ts:12,79` (`encryptField` antes de persistir) |
| AuditLog con cadena de integridad SHA-256 | CONFIRMADO | `schema.prisma:388-411` (`integrityHash`, `previousHash`, `chainSequence` UNIQUE) + `backend/src/audit/audit.service.ts:65-70` (SHA-256), `:140-233` (append-only), `:235-338` (acquireAuditChainHead serializada) |
| Verificacion de cadena (`audit:integrity:verify`) con snapshot | CONFIRMADO | `audit.service.ts:406-576` + `schema.prisma:413-433` (`AuditChainState`, `AuditIntegritySnapshot`) |
| Diff de auditoria sanitizado | CONFIRMADO | `audit.service.ts:149` llama `sanitizeDiff(entityType, diff)` definido en `backend/src/audit/audit-helpers.ts` |
| Export regulatorio admin-only via ZIP | CONFIRMADO | `backend/src/patients/patients-regulatory.controller.ts:42` (`@UseGuards(JwtAuthGuard, AdminGuard)`), `:49-60` |
| Purge regulatorio con confirmacion, justificacion ≥16 chars, retencion default 15 anos | CONFIRMADO | `backend/src/patients/patients-regulatory-purge.service.ts:8` (`DEFAULT_PURGE_MIN_AGE_DAYS = 5475`), `:33-39` (validacion), `:53-64` (retencion) |
| Snapshot pre-purge | CONFIRMADO | `patients-regulatory-purge.service.ts:67` invoca `snapshotForPurge` |
| Sentry con `sendDefaultPii=false`, headers/cookies/data removidos, scrub | CONFIRMADO | `backend/src/instrument.ts:49-77` (`sendDefaultPii: false`, `delete event.user`, `cookies: undefined`, `data: undefined`, `scrubPhi`) |
| LegalDocument versionable y aceptacion por usuario | CONFIRMADO | `schema.prisma:538-574` (`UserLegalAcceptance`, `LegalDocument`) + `shared/legal-contract.ts` |
| Modo equipo compartido fuerza desactivacion de offline | CONFIRMADO | `frontend/src/stores/privacy-settings-store.ts:5,21,48,51,65,78` (FORCE_SHARED_DEVICE_MODE bloquea offline) + `.env.example` lo declara `=true` por defecto |
| AV scan opcional con SKIPPED si no hay ClamAV | CONFIRMADO | `backend/src/attachments/attachments-scan.service.ts:30-36` |
| InformedConsent con tipos extendidos incluyendo DATOS_PERSONALES | CONFIRMADO (matiz) | `backend/src/consents/dto/consent.dto.ts:4` declara `'TRATAMIENTO','DATOS_PERSONALES','PROCEDIMIENTO','INVESTIGACION'`. El schema (`schema.prisma:625`) por defecto es `'TRATAMIENTO'`. **El modelo no fuerza la existencia de un consent DATOS_PERSONALES por paciente.** |

### Hallazgos negativos verificados (lo que NO existe en el repo)

Confirmado por busqueda exhaustiva con grep en `backend/src/`, `frontend/src/` y `shared/`:

| Funcionalidad esperada por la ley | Estado verificado | Evidencia de ausencia |
|---|---|---|
| Entidad `DataSubjectRequest` (o equivalente) para gestionar solicitudes ARCO+ | NO EXISTE | `grep -rli "DataSubjectRequest\|data-subject-request\|patient_data_request"` retorna cero coincidencias |
| Campo de bloqueo temporal del tratamiento (Art 8 ter) | NO EXISTE | `grep -rli "bloqueoTemporal\|temporalBlock\|patientBlocked"` retorna cero coincidencias en `backend/src/` y `frontend/src/` |
| Flag de oposicion / opt-out a analitica (`statisticsOptOut`, `processingRestrictions`) | NO EXISTE | Documentado como "pendiente de implementar en schema" en `docs/data-privacy-and-compliance.md:124`. Cero coincidencias en codigo. |
| Representante legal / tutor / consentimiento parental para NNA (Art 16 quater) | NO EXISTE | No hay campos `representanteLegal`, `tutorLegal`, `parentalConsent` en `Patient` ni en ninguna entidad. El modelo `Patient` (`schema.prisma:76-119`) solo guarda `fechaNacimiento` y `edad`. |
| Documento DPIA / evaluacion de impacto (Art 15 ter) | NO EXISTE | `grep -rli "DPIA\|evaluacion-impacto"` no retorna documento alguno bajo `docs/` |
| Registro de actividades de tratamiento (RAT, Art 14 ter + acreditacion Art 3 e) | NO EXISTE | Solo se menciona como pendiente en `docs/data-privacy-and-compliance.md:267`. No hay `docs/data-processing-register.md`. |
| Cifrado app-level para datos identificatorios del paciente (rut, nombre, email, telefono, domicilio, contactoEmergencia) | NO EXISTE | `Patient` (`schema.prisma:79-97`) almacena estos campos como `String` plano. Solo `EncounterSection.data` esta cifrado a nivel app. Dependencia total de cifrado de filesystem para PII demografica. |
| Cifrado app-level para adjuntos | NO EXISTE | `backend/src/attachments/` no usa `encryptField`. Los archivos se almacenan en `storagePath` tal cual. Dependencia total de cifrado de filesystem. |
| Cifrado de snapshots regulatorios pre-purge | NO EXISTE | `patients-regulatory-export.service.ts` `snapshotForPurge` escribe el ZIP plano en `runtime/data/purges/`. **El ZIP contiene PHI desencriptada y adjuntos en claro.** |
| Vinculacion entre InformedConsent y version de politica de privacidad aceptada | NO EXISTE | El consent paciente no referencia `LegalDocument.version`; solo `UserLegalAcceptance` (usuarios del sistema) lo hace. |
| UI / endpoint publico para que el titular ejerza sus derechos | NO EXISTE | Toda gestion es admin-only via back office (`PatientsRegulatoryController` requiere `AdminGuard`). |
| Plantillas de comunicacion al titular (acuse, rechazo fundado, brecha) | NO EXISTE | No hay templates en `backend/src/mail/` ni en `backend/src/templates/` para respuestas regulatorias. |
| Plantilla y registro de vulneraciones (Art 14 sexies) | NO EXISTE | `docs/incident-runbooks.md` tiene runbooks tecnicos pero ninguno alineado al estandar de "riesgo razonable" y notificacion a titulares de la ley. |

### Hallazgos criticos nuevos detectados por la verificacion tecnica

1. **Politica de privacidad seeded marcada como "no apta para produccion".** El seed publica un `LegalDocument` `PRIVACY` version `2026-05-02` cuyo `footerNote` dice literalmente: *"Documento base para entornos de desarrollo y pruebas; requiere revision legal antes de produccion."* (`backend/prisma/seed.ts:74`). El contenido tiene solo 2 parrafos, 1 categoria de datos y NO cumple ninguno de los 12 elementos del Art 14 ter (falta: identificacion del responsable, DPO/encargado de prevencion, domicilio postal, destinatarios, finalidades detalladas con base legal, politica de seguridad, transferencias internacionales, periodo de conservacion, fuente de datos, decisiones automatizadas, derecho a reclamar ante la Agencia). Si una clinica despliega sin reemplazar este documento, esta tecnicamente publicando una politica autodeclarada como invalida. **Riesgo P0 confirmado en codigo.**

2. **El `InformedConsent` se otorga por un `User` del sistema, no por el titular.** El schema (`schema.prisma:628`) define `grantedById String @map("granted_by_id")` con relacion `@relation("ConsentGrantedBy")` a `User`, no a `Patient`. Esto significa que el consentimiento queda registrado como una accion del medico/asistente, no como una manifestacion de voluntad del titular en los terminos del Art 12 ("toda manifestacion de voluntad libre, especifica, inequivoca e informada... mediante una declaracion o una clara accion afirmativa, mediante la cual el titular de datos, su representante legal o mandatario, segun corresponda, autoriza el tratamiento"). El registro actual no satisface la carga de la prueba del responsable. **Brecha estructural P0 nueva.**

3. **El snapshot pre-purge se persiste en claro.** `patients-regulatory-export.service.ts:226-235` escribe el ZIP en `runtime/data/purges/` sin cifrado a nivel aplicacion. El ZIP contiene PHI desencriptada + adjuntos. Si el filesystem encryption se desactiva o se monta el volumen para mantenimiento, los snapshots quedan expuestos. La proteccion documentada en la auditoria como "depende de filesystem encryption" se cumple solo en ese escenario. **Brecha P0 confirmada.**

4. **Datos identificatorios del paciente sin cifrado app-level.** El modelo `Patient` (`schema.prisma:79-97`) guarda `rut`, `nombre`, `email`, `telefono`, `domicilio`, `contactoEmergencia*` como `String` planos. Solo `EncounterSection.data` esta protegido por `encryptField`. Si la base SQLite es exfiltrada (y filesystem encryption fue bypaseado o el ambiente no es produccion), el RUT y datos de contacto quedan visibles. Para un sistema clinico chileno, donde el RUT permite reidentificar al titular y cruzar bases, esta es una **brecha de minimizacion / seguridad relevante**.

5. **El doc `docs/data-privacy-and-compliance.md` esta desactualizado en varios puntos:**
   - §5.3 dice "Borrado fisico (pendiente de implementar)" pero `PatientsRegulatoryPurgeService` ya existe (`backend/src/patients/patients-regulatory-purge.service.ts`).
   - §7.1 describe procedimiento sqlite3 manual y dice "PENDIENTE implementar endpoint" pero `GET /api/patients/:id/export/regulatory` ya existe (`patients-regulatory.controller.ts:49`).
   - §7.2 dice "PENDIENTE script `db:purge-patient`" pero `DELETE /api/patients/:id/purge` ya existe (`patients-regulatory.controller.ts:62`).
   - §7.3 cita "Ley 21.719 Art. 29" para notificacion de brechas en 72h. Es **incorrecto**: el Art 29 es fiscalizacion de transferencias internacionales; la notificacion de brechas es el **Art 14 sexies** y el plazo legal NO es 72h sino "sin dilaciones indebidas".
   - §5.1 menciona "Art. 13 Ley 21.719" para derecho de acceso. Es **incorrecto**: el derecho de acceso es **Art 5**; el Art 13 trata otras bases de licitud sin consentimiento.
   - Documenta `statisticsOptOut` como "pendiente de implementar" — confirmado, sigue ausente.

6. **El backend asume retencion de 15 anios por defecto sin amparo legal especifico.** `patients-regulatory-purge.service.ts:8` define `DEFAULT_PURGE_MIN_AGE_DAYS = 5475` (15 anios). El "Codigo Sanitario" no fija un plazo unico de 15 anios para toda ficha clinica; la regla 15 anios viene de la Norma Tecnica 28 de FONASA y aplica solo a algunas categorias. La auditoria ya menciona la necesidad de validacion legal sanitaria; aqui se confirma que el codigo asume un valor sin documentar la fuente normativa.

7. **JWT y sesiones tienen los plazos correctos:** access token 15m (`.env.example:44`) y refresh token 7d (`.env.example:59`) son razonables y consistentes con buenas practicas.

### Verificacion del despliegue por defecto (.env.example)

- `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true` — confirmado por defecto. Bueno: la cola offline no guarda PHI en IndexedDB.
- `ENCRYPTION_KEY=` (vacio) — el repo no trae clave, obliga al operador a generarla en cada despliegue. Bueno.
- `ENCRYPTION_AT_REST_CONFIRMED=false` — el operador debe confirmarlo manualmente tras verificar LUKS/dm-crypt. Bueno.
- `SETTINGS_ENCRYPTION_KEY=replace-with-a-secure-settings-key` — placeholder; el gate de produccion rechaza placeholders.

### Resumen del estado real vs lo que la auditoria afirmaba

La auditoria original era en general fiel al codigo, pero la verificacion tecnica anadio o agudizo estas brechas:

1. **Politica de privacidad publicada hoy es explicitamente "no apta para produccion"** (no es solo "incompleta" — es un placeholder declarado).
2. **El consentimiento del paciente esta modelado como accion del usuario del sistema**, no del titular: gap estructural, no cosmetico.
3. **Datos identificatorios del paciente NO estan cifrados a nivel app**: la auditoria decia "PII de pacientes protegida" sin matizar este detalle.
4. **Snapshots pre-purge en claro**: ya estaba flageado, confirmado en codigo.
5. **El doc de compliance esta desactualizado**: cita articulos equivocados (Art 13 en vez de Art 5, Art 29 en vez de 14 sexies) y describe como "pendiente" cosas que ya existen.

## Matriz de cumplimiento

| Requisito Ley 21.719 | Estado | Evidencia actual | Brecha / accion requerida |
|---|---|---|---|
| Ambito y roles: responsable, encargado, titular, tratamiento | Parcial | `docs/data-privacy-and-compliance.md` contiene un DPA minimo; despliegue `single-clinic` documentado. | Formalizar por cliente quien es responsable, encargado y subencargado. Crear DPA definitivo, inventario de subencargados y responsabilidades operativas. |
| Datos sensibles de salud | Parcial alto | Schema registra pacientes, atenciones, secciones clinicas, diagnosticos, tratamientos, adjuntos, alertas y consentimientos. `ENCRYPTION_KEY` obligatorio en prod. | Mantener inventario de categorias por finalidad y base legal. Documentar si hay menores, datos biometricos, geneticos o geolocalizacion en cada despliegue. |
| Principios de licitud, finalidad y proporcionalidad | Parcial | Documentacion declara finalidades y ausencia de marketing. DTOs y `ValidationPipe` limitan campos no permitidos. | Falta registro formal de actividades de tratamiento y matriz finalidad/base legal/categoria/retencion/destinatarios. |
| Calidad/exactitud de datos | Parcial | Edicion de datos, verificacion demografica y completitud existen en pacientes. | Agregar procedimiento legal de rectificacion con acuse, plazo, prueba de respuesta y comunicacion a destinatarios cuando corresponda. |
| Transparencia e informacion publica | Parcial | Rutas publicas `/politica-de-privacidad` y `/terminos-y-condiciones`; documentos legales versionables y publicables por admin. | Publicar politica vigente completa: responsable, DPO/contacto, categorias, finalidades, bases, destinatarios, transferencias, retencion, seguridad, derechos y reclamo ante Agencia. |
| Consentimiento y otras bases de licitud | Parcial | `UserLegalAcceptance` registra aceptacion de usuarios; `InformedConsent` registra consentimientos clinicos y revocacion. | Falta evidencia clara de consentimiento/base de licitud para pacientes respecto al tratamiento de datos personales/sensibles, representante legal cuando aplique y version de politica informada. |
| Derechos de acceso y portabilidad | Parcial alto | `GET /api/patients/:id/export/regulatory` genera ZIP admin-only con `data.json`, adjuntos y auditoria `PATIENT_DATA_EXPORTED_REGULATORY`. | Falta flujo de solicitud del titular: formulario/correo, autenticacion de identidad, acuse, SLA 30 dias, prorroga, entrega segura y evidencia de respuesta. |
| Derecho de rectificacion | Parcial | Edicion de paciente/historial y auditoria de mutaciones. | Falta workflow formal de solicitud, bloqueo mientras se resuelve cuando aplique y comunicacion a terceros destinatarios. |
| Derecho de supresion | Parcial | Soft delete medico; purge regulatorio admin-only con confirmacion, justificacion, snapshot y retencion minima por defecto de 15 anos. | Validar legalmente retencion sanitaria por tipo de ficha. Definir excepciones y respuesta fundada cuando no proceda supresion. Proteger snapshots de purge, que contienen PHI desencriptada. |
| Derecho de oposicion | Pendiente | Documentacion menciona `statisticsOptOut` pendiente. | Implementar flag por paciente/finalidad, excluir de analitica no esencial y documentar cuando la oposicion no proceda por base legal sanitaria. |
| Derecho de bloqueo temporal | Pendiente | No se observo entidad/estado para bloquear tratamiento durante solicitudes. | Implementar `PatientDataRequest` y estados de bloqueo por tratamiento/dato, con SLA de 2 dias habiles para responder bloqueo. |
| Deber de secreto/confidencialidad | Parcial | Acceso por roles, medico efectivo, auditoria y minimizacion de logs. | Incorporar obligaciones de confidencialidad en contratos laborales/servicio, capacitacion y sanciones internas. |
| Proteccion desde el diseno y por defecto | Parcial alto | `single-clinic`, same-origin `/api`, cookies HttpOnly, CSRF, offline local desactivable/forzado por `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true`. | Hacer obligatorio en produccion que no haya PHI offline sin cifrado local. Documentar DPIA/evaluacion de riesgos antes de nuevas funciones analiticas o IA. |
| Seguridad del tratamiento | Parcial alto | 2FA, lockout, JWT con sesiones revocables, CSRF, Helmet, CORS allowlist, cifrado de secciones clinicas, filesystem encryption gate, auditoria con hash chain, backups y restore drills. | Adjuntos y backups dependen de cifrado de filesystem; considerar cifrado app-level para adjuntos/backups/snapshots. AV scan es opcional y queda `SKIPPED` si no hay ClamAV. |
| Reporte de brechas | Parcial | `docs/data-privacy-and-compliance.md` y `docs/incident-runbooks.md` tienen runbooks operativos. | Ajustar a Ley 21.719: registro de vulneraciones, reporte a Agencia sin dilaciones indebidas cuando haya riesgo razonable, notificacion a titulares cuando involucre datos sensibles, plantillas y responsables. |
| Transferencias internacionales | Pendiente/parcial | DPA referencial lista Cloudflare, Sentry y SMTP como subencargados. `sendDefaultPii=false` y scrub de Sentry. | Inventariar hosting, Cloudflare, Sentry, SMTP y cualquier soporte externo. Definir paises, garantias, DPA, clausulas contractuales/modelos aprobados o base legal especifica. Informarlo en politica. |
| Encargados/subencargados | Parcial | DPA minimo documentado. | Contratos reales: objeto, duracion, naturaleza, categorias, instrucciones, seguridad, confidencialidad, asistencia en derechos, retorno/destruccion al terminar. |
| Modelo de prevencion de infracciones | Pendiente | No se observo programa formal en repo, solo controles tecnicos y documentacion. | Crear programa: DPO, mapa de datos, riesgos, protocolos, reportes internos, denuncia/sancion, capacitacion, auditorias y eventual certificacion ante Agencia. |
| Delegado de proteccion de datos | Pendiente | `docs/data-privacy-and-compliance.md` lo menciona como rol. | Designar formalmente DPO/encargado, publicar contacto, darle autonomia, recursos, plan anual y registro de consultas. |
| Sanciones y evidencia defensiva | Parcial | Auditoria con cadena de integridad, eventos de lectura, snapshots, tests y docs operativos. | Consolidar evidencias en un repositorio de compliance: politicas vigentes, capacitaciones, incidentes, solicitudes, contratos, revisiones periodicas y verificaciones tecnicas. |

## Controles ya implementados

### Seguridad y acceso

- Cookies `HttpOnly`, `SameSite=strict` y `Secure` en produccion.
- Access token de vida corta y refresh token con versionado.
- Sesiones persistidas y revocables por usuario/dispositivo.
- 2FA TOTP opcional con recovery codes.
- Bloqueo persistente tras intentos fallidos.
- CSRF double-submit en mutaciones no publicas.
- Guards por rol (`MEDICO`, `ASISTENTE`, `ADMIN`) y scoping por medico efectivo.
- `AdminGuard` para superficies regulatorias, auditoria global, usuarios y settings.
- `ValidationPipe` con `whitelist` y `forbidNonWhitelisted`.
- CORS allowlist y arquitectura same-origin via `/api`.

### Proteccion de datos en reposo y transito

- HTTPS esperado via Cloudflare Tunnel en despliegue soportado.
- Produccion falla si no existe `ENCRYPTION_KEY` valido para secciones clinicas.
- Produccion falla si no se confirma cifrado de filesystem con `ENCRYPTION_AT_REST_CONFIRMED=true`.
- Settings sensibles cifrados con `SETTINGS_ENCRYPTION_KEY`.
- Adjuntos validan magic bytes y restringen tipos MIME permitidos.
- AV scan para adjuntos existe, pero depende de `CLAMAV_HOST`/`CLAMAV_PORT`.

### Auditoria y trazabilidad

- `AuditLog` registra entidad, usuario, accion, razon, resultado, request id, diff minimizado y timestamps.
- Cadena de integridad con `previousHash`, `integrityHash` y `chainSequence`.
- Endpoint admin para verificar integridad de cadena.
- Eventos de lectura sobre PHI en pacientes, encuentros, consentimientos, alertas, adjuntos y analitica.
- Diffs clinicos se minimizan/redactan para no persistir PHI completa dentro del log de auditoria.

### Derechos del titular y ciclo de vida

- Export regulatorio completo en ZIP admin-only.
- Export clinico por PDF/bundle para usuarios autorizados.
- Purge regulatorio admin-only con confirmacion explicita, justificacion, snapshot previo y retencion minima configurable.
- Soft delete de pacientes y adjuntos.
- Legal documents versionables y publicables.
- Registro de aceptacion legal para usuarios del sistema.

### Operacion

- Backups SQLite, restore drills, monitoreo Prometheus/Grafana/Loki.
- Runbooks de incidentes, despliegue y operacion.
- Sentry backend con `sendDefaultPii=false`, headers/cookies/data removidos y scrub de RUT/email/digitos largos.
- Modo equipo compartido puede desactivar guardado offline local con PHI.

## Brechas prioritarias

### P0 - Antes de tratar datos reales bajo regimen Ley 21.719

> Cada item indica al final si la brecha es CODIGO (requiere cambio en el repo), LEGAL/OPERATIVO (decision externa al repo), o AMBOS.

1. **Reemplazar la politica de privacidad seeded.** El documento publicado por `backend/prisma/seed.ts:74` se autodeclara como "no apto para produccion". Redactar version 1.0 con los 12 elementos del Art 14 ter y publicarla como `LegalDocument` `PRIVACY` activa, junto con eliminar el footer note de pruebas. **CODIGO + LEGAL.**
2. **Refactorizar el modelo de consentimiento del titular.** `InformedConsent.grantedById` (`schema.prisma:628`) apunta a `User` (medico/asistente). Para satisfacer el Art 12, agregar un modelo o campos que registren: identidad del titular (o representante), version del `LegalDocument` aceptada, metodo de captura (presencial, electronico), evidencia (firma digital, IP, timestamp). Considerar nueva entidad `PatientDataProcessingConsent` separada de `InformedConsent` clinico. **CODIGO + LEGAL.**
3. **Crear registro de actividades de tratamiento (RAT)** como `docs/data-processing-register.md` con matriz finalidad / base legal / categorias / titulares / destinatarios / transferencias / retencion / medidas de seguridad. Acredita el principio de responsabilidad (Art 3 lit e). **LEGAL/OPERATIVO.**
4. **Formalizar responsable/encargado/subencargados por CONTRATO ESCRITO** (Art 15 bis). El DPA actual en `docs/data-privacy-and-compliance.md` §6 es un template; firmar con cada clinica y con cada subencargado (Cloudflare, Sentry, SMTP). **LEGAL/OPERATIVO.**
5. **Implementar entidad `PatientDataRequest`** que cubra los 6 derechos del Art 4 (acceso, rectificacion, supresion, oposicion, portabilidad, bloqueo) con acuse de recibo, plazos del Art 11 (30 dias corridos + prorroga 30 corridos), respuesta, rechazo fundado y evidencia. Hoy no existe (verificado: cero coincidencias en grep). **CODIGO.**
6. **Implementar bloqueo temporal del tratamiento** (Art 8 ter): campo en `Patient` o tabla relacionada para suspender tratamiento durante resolucion de solicitudes, con plazo de respuesta de 3 dias habiles (Art 41 final). Hoy no existe en schema. **CODIGO.**
7. **Implementar oposicion / opt-out a analitica no esencial** (Art 8): campo `Patient.processingObjections` o tabla por finalidad. Documentado como "pendiente" desde hace al menos 6 meses en `docs/data-privacy-and-compliance.md:124`. **CODIGO.**
8. **Implementar tratamiento diferenciado de NNA** (Art 16 quater): agregar `Patient.representanteLegal*` (nombre, RUT, parentesco, contacto) y entidad `ParentalConsent` para menores de 14 y para datos sensibles de menores de 16. Hoy `Patient` solo guarda `fechaNacimiento`/`edad` sin distincion etaria de flujo. **CODIGO + LEGAL.**
9. **Realizar y documentar DPIA** (Art 15 ter). Anamneo trata datos sensibles bajo excepcion del consentimiento (Art 16 b/e), causal (d) del Art 15 ter. La DPIA debe quedar en `docs/dpia-anamneo.md` o similar y ser revisada anualmente. **LEGAL + parte CODIGO (medidas mitigatorias).**
10. **Cifrar a nivel aplicacion los snapshots regulatorios**. `patients-regulatory-export.service.ts:226` debe cifrar el ZIP antes de escribirlo en `runtime/data/purges/` (preferible: misma `ENCRYPTION_KEY` o clave dedicada `REGULATORY_SNAPSHOT_KEY`). Hoy se persiste en claro. **CODIGO.**
11. **Cifrar a nivel aplicacion los adjuntos** o documentar formalmente la dependencia de filesystem encryption con DPIA que lo justifique. `attachments/` no usa `encryptField` hoy. **CODIGO o LEGAL formal.**
12. **Cifrar a nivel aplicacion datos identificatorios del paciente** (rut, telefono, email, domicilio, contactoEmergencia) o aceptar formalmente el riesgo en la DPIA. Hoy son `String` plano en `Patient`. **CODIGO o LEGAL.**
13. **Inventariar transferencias internacionales y sus garantias** (Arts 27-28): Cloudflare, Sentry, SMTP, hosting, soporte externo. Suscribir clausulas modelo cuando la Agencia las publique. **LEGAL/OPERATIVO.**
14. **Designar formalmente DPO** (Art 50) y publicar contacto operativo en politica y headers de contacto. **LEGAL/OPERATIVO.**
15. **Crear procedimiento de brechas alineado al Art 14 sexies**: criterios de "riesgo razonable", plantilla de reporte a la Agencia, plantilla a titulares (obligatoria por tratar datos sensibles), registro de vulneraciones. Hoy `docs/incident-runbooks.md` no esta alineado al estandar legal. **CODIGO (plantillas en `backend/src/templates/`) + LEGAL.**
16. **Actualizar y corregir `docs/data-privacy-and-compliance.md`**: corregir citas erroneas (Art 13 → Art 5; Art 29 → Art 14 sexies); marcar como implementados export regulatorio (§7.1) y purge (§7.2); alinear retencion (§8) con asesoria legal sanitaria; eliminar referencias a "ARCO+" sustituyendo por el catalogo legal Art 4. **CODIGO (doc).**

### P1 - Para reducir riesgo sancionatorio y operacional

1. Crear entidad `DataSubjectRequest` o equivalente para solicitudes ARCO+, portabilidad y bloqueo.
2. Crear entidad o campos de consentimiento/base legal por paciente, finalidad, version de politica, representante y metodo de captura.
3. Agregar `statisticsOptOut` o `processingRestrictions` por paciente.
4. Agregar umbrales de privacidad en analitica: k-anonymity minimo, suppression de cohortes pequenas y export con advertencias.
5. Forzar ClamAV o bloquear uploads si `scanStatus` queda `SKIPPED` en produccion, segun apetito de riesgo.
6. Cifrar adjuntos a nivel aplicacion o documentar formalmente por que basta filesystem encryption.
7. Revisar retencion por categoria: ficha clinica, consentimientos, auditoria, logs tecnicos, backups, invitaciones, reset tokens y snapshots de purge.
8. Incorporar verificacion periodica de `audit:integrity:verify` y restore drills en evidencia de compliance.
9. Crear plantillas de comunicacion: acceso, rectificacion, supresion denegada, bloqueo, portabilidad, brecha y reclamo ante Agencia.

### P2 - Madurez de cumplimiento

1. Adoptar programa de cumplimiento / modelo de prevencion de infracciones.
2. Capacitacion anual obligatoria para usuarios con acceso a PHI.
3. Revisiones semestrales de permisos y usuarios activos.
4. Evaluacion de impacto para nuevas funciones con analitica avanzada, IA, perfilamiento o integraciones externas.
5. Preparar evidencia para eventual certificacion del modelo ante la Agencia cuando el reglamento y procedimientos esten operativos.

## Observaciones de riesgo especificas

### Export regulatorio y purge

`PatientsRegulatoryExportService` descifra secciones clinicas y genera un ZIP con `data.json` y adjuntos. Esto es correcto para acceso/portabilidad, pero el archivo resultante es extremadamente sensible. `snapshotForPurge` lo persiste en `runtime/data/purges` antes del borrado fisico. Se debe definir cifrado, ACLs, retencion, destruccion segura y auditoria de acceso para esos snapshots.

### Analitica clinica

El resumen analitico usa datos agregados, pero la vista de casos devuelve nombre, RUT y detalle clinico por paciente. Esto es util para el medico tratante, pero no debe considerarse anonimizado. Para estadisticas o investigacion debe aplicarse anonimizacion real, supresion de cohortes pequenas y finalidad/base legal independiente.

### Modo offline

La cola offline guarda payloads clinicos en IndexedDB cuando no esta activo el modo equipo compartido. En los ejemplos productivos se fuerza `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true`, lo que mitiga el riesgo. Si se habilita offline en produccion, debe existir cifrado local con clave de sesion, expiracion corta, borrado verificable y documentacion al titular.

### Adjuntos

Los adjuntos se validan por firma y pueden escanearse con ClamAV, pero el scan queda deshabilitado si no hay host/puerto configurado. Ademas, los archivos dependen del cifrado del filesystem. Por ser PHI potencialmente completa, esto debe elevarse a decision formal de seguridad.

### Diffs y auditoria

La minimizacion de diffs clinicos es positiva. Aun asi, el `AuditLog` puede contener metadatos personales, IDs, userId, requestId, IP en algunos eventos y trazas de acciones clinicas. Debe incluirse en el registro de actividades, politica de retencion y controles de acceso.

## Plan recomendado hacia el 2 de diciembre de 2026

### Junio-Julio 2026

- Cerrar definiciones legales: responsable/encargado, subencargados, DPA, DPO, finalidades y bases de licitud.
- Redactar y publicar politica de privacidad v1.0.
- Crear registro de actividades de tratamiento.
- Definir matriz de retencion con asesor legal sanitario.

### Agosto-Septiembre 2026

- Implementar `DataSubjectRequest`.
- Implementar bloqueo temporal, oposicion y restricciones de tratamiento.
- Implementar evidencia de consentimiento/base legal por paciente y finalidad.
- Endurecer snapshots regulatorios, backups y adjuntos.
- Crear plantillas de respuesta y brechas.

### Octubre 2026

- Ejecutar simulacro de solicitud de acceso, rectificacion, oposicion, bloqueo, portabilidad y supresion denegada por retencion sanitaria.
- Ejecutar simulacro de brecha con datos sensibles.
- Ejecutar revision de permisos y usuarios.
- Ejecutar prueba de restore y verificacion de cadena de auditoria.

### Noviembre 2026

- Auditoria legal externa.
- Auditoria tecnica final contra ambiente staging con configuracion productiva.
- Congelar cambios no criticos.
- Capacitar usuarios y responsables internos.
- Dejar evidencia firmada de politicas, procedimientos, contratos y pruebas.

### 1-2 de diciembre 2026

- Verificar que politica publicada, DPO/contacto, registro de actividades, contratos, runbooks, procesos de derechos y controles tecnicos esten operativos.
- Ejecutar checklist de produccion: health, backups, restore drill, audit integrity, variables de seguridad, ClamAV si aplica, Sentry/observabilidad y controles de acceso.

## Checklist final de cumplimiento operativo

- [ ] Politica de privacidad vigente publicada y accesible, con los 12 elementos del art 14 ter.
- [ ] Contacto de derechos/DPO publicado y operativo (art 50).
- [ ] Registro de actividades de tratamiento aprobado (acreditacion art 3 lit e).
- [ ] DPA firmado con clinica y contratos con subencargados, con clausulas minimas del art 15 bis.
- [ ] Inventario de transferencias internacionales y garantias (arts 27-28).
- [ ] DPIA realizada y documentada para tratamiento de datos sensibles (art 15 ter).
- [ ] Flujo de tratamiento de datos de NNA implementado con representante legal y consentimiento parental cuando aplique (art 16 quater).
- [ ] Procedimiento de derechos del titular probado, con plazos del art 11.
- [ ] Procedimiento de bloqueo temporal probado (art 8 ter, plazo art 41).
- [ ] Procedimiento de brechas probado contra art 14 sexies (criterios de "riesgo razonable", notificacion a titulares por ser datos sensibles).
- [ ] Base de licitud/consentimiento documentada por finalidad, con cita expresa a la ley sanitaria especial que ampara el tratamiento de salud (art 16 bis).
- [ ] Retencion y supresion validadas por asesor legal, justificando excepciones del art 7.
- [ ] Cifrado en reposo verificado para DB, uploads, backups y snapshots (art 14 quinquies lit a).
- [ ] `ENCRYPTION_KEY`, `SETTINGS_ENCRYPTION_KEY`, JWT secrets y `BOOTSTRAP_TOKEN` rotados y seguros.
- [ ] 2FA requerido o politica formal para cuentas privilegiadas.
- [ ] Usuarios y roles revisados.
- [ ] Backups y restore drills funcionando.
- [ ] Cadena de auditoria verificada (`audit:integrity:verify`).
- [ ] ClamAV o decision formal equivalente para adjuntos.
- [ ] Offline PHI desactivado o cifrado local implementado.
- [ ] Capacitacion y obligaciones de confidencialidad registradas (art 14 bis).
- [ ] Programa de prevencion de infracciones implementado (art 48 obligatorio). Modelo del art 49 voluntario evaluado para certificacion (art 51) como atenuante (art 36.5).

---

## Estado tras ejecucion del roadmap Olas 0-4 (2026-05-23)

Esta seccion documenta lo entregado por la ejecucion del plan
(`/home/allopze/.claude/plans/crea-un-plan-para-logical-hearth.md`)
sobre el codigo y la documentacion del repo. Cada item dice CODIGO,
DOC o AMBOS y cita los archivos creados/modificados.

### Resumen ejecutivo post-implementacion

- Las **16 brechas P0** identificadas en la auditoria se cerraron tecnicamente
  en su parte de codigo y documentacion estructural. Cada brecha que requiere
  contenido legal (politica v1.0 redactada, DPA con subencargados, RAT firmado,
  DPIA validada, plazos sanitarios especificos, plantillas firmadas) quedo con
  estructura completa y marcadores `[PENDIENTE_ABOGADO]` o
  `[PENDIENTE_OPERATIVO]` para identificar exactamente que falta del trabajo
  externo.
- `npx prisma validate` pasa; `npx tsc --noEmit` pasa en backend y frontend.
- La migracion Prisma `20260523053538_ley21719_compliance_full` fue
  **generada pero NO aplicada** (`prisma migrate dev --create-only`). El user
  debe aplicarla con `npx prisma migrate dev` cuando este listo. ATENCION:
  esta migracion **DROPEA `informed_consents`** (el rename a `clinical_consents`
  se hace via DROP + CREATE porque no hay clientes reales — segun ADR-002).

### Ola 0 — Saneamiento de base [COMPLETA]

| Entregable | Archivo | Estado |
|---|---|---|
| ADR-002 maestro del cumplimiento | `docs/architecture-decisions/002-ley-21719-compliance.md` | CREADO |
| Doc `data-privacy-and-compliance.md` reescrito | `docs/data-privacy-and-compliance.md` | RESCRITO (citas correctas, refleja endpoints reales) |
| Seed bloqueado en produccion | `backend/prisma/seed.ts` (`assertLegalDocumentsAreProductionReady`) | CREADO + verificado |
| Lista de preguntas para asesor legal | `docs/preguntas-abogado-ley21719.md` | CREADO (5 secciones, ~30 preguntas) |
| DPO interino formalizado en docs | `docs/data-privacy-and-compliance.md` §9 + ADR-002 | Alejandro Lopez Zelaya `<allopze@gmail.com>` |

### Ola 1 — Modelo de consentimiento + Politica v1.0 [COMPLETA EN CODIGO; CONTENIDO LEGAL PENDIENTE]

**Schema Prisma (`backend/prisma/schema.prisma`)**:
- Renombrado `InformedConsent` → `ClinicalConsent` (`@@map("clinical_consents")`).
- Nueva entidad `PatientDataProcessingConsent` con campos: `patientId`, `legalDocumentId`, `purpose`, `granted`, `method`, `capturedIp`, `capturedUserAgent`, `capturedByUserId`, `signerName`, `signerRut`, `signerRelationship`, `evidenceHash` SHA-256, timestamps.
- Patient extendido con: `blockedAt`, `blockedReason`, `blockedById` (Art 8 ter); `processingObjections` JSON (Art 8); `legalRepresentativeName/Rut/Relationship/Contact` (Art 16 quater).

**Backend (`backend/src/patient-consents/`)** [CODIGO COMPLETO]:
- `PatientConsentsService` con metodos: `hasVigentConsentForActivePrivacyPolicy`, `listForPatient`, `grant` (incluye `assertNNAConsentValid` para Art 16 quater), `revoke`.
- `PolicyComplianceService` con tres modos (`hard`/`soft`/`off` via `REGULATORY_CONSENT_ENFORCEMENT`).
- `PatientConsentsController` con endpoints: `GET /patient-consents/patient/:patientId`, `POST /patient-consents/grant`, `POST /patient-consents/:id/revoke`.
- Modulo registrado en `AppModule`.

**Audit catalog (`backend/src/common/types/index.ts` + `backend/src/audit/audit-catalog.ts`)**:
- Agregadas razones: `PATIENT_DATA_CONSENT_GRANTED/REVOKED/LIST_VIEWED`, `PATIENT_RIGHT_REQUESTED/RESOLVED_*/EXPIRED/LIST_VIEWED`, `PATIENT_BLOCKED/UNBLOCKED`, `DATA_BREACH_DETECTED/REPORTED_TO_AGENCY/NOTIFIED_TO_SUBJECTS/CLOSED`.
- `inferAuditReason` actualizado con las nuevas entidades. `CLINICAL_ENTITY_TYPES` incluye `PatientDataProcessingConsent`, `PatientDataRequest`, `DataBreachIncident` para minimizacion de PHI en diffs.

**Seed (`backend/prisma/seed.ts`)** [DRAFT INTERNO; PENDIENTE_ABOGADO redactar contenido]:
- Agregado `LegalDocument` con `version: '1.0-DRAFT'`, `status: 'DRAFT'`, estructura completa con los 12 elementos del Art 14 ter y secciones marcadas `[PENDIENTE_ABOGADO]`.
- Seed loop actualizado para respetar `doc.status` cuando esta explicitamente definido.

**Docs**:
- `docs/dpia-2026.md` CREADO (DPIA estructural Art 15 ter con marcadores).
- `docs/data-processing-register.md` CREADO (RAT estructural Art 14 ter / Art 15 bis con marcadores).

### Ola 2 — Derechos del titular (Arts 4-11) [COMPLETA EN CODIGO]

**Schema**: nueva entidad `PatientDataRequest` con `requestType`, `status`, `submittedBy`, `requesterName/Rut/Email`, `identityVerificationMethod/Evidence`, `dueDate` (= submittedAt + 30 dias), `prorrogaDueDate`, `resolvedAt/ById`, `resolutionNote`, `payloadRequest/Response`.

**Backend (`backend/src/patient-data-rights/`)** [CODIGO COMPLETO]:
- `PatientDataRightsService` con metodos publicos `createFromPublic` (sin auth), y admin: `list`, `getById`, `adminUpdate`, `extend` (Art 11 prorroga), `resolve`. Incluye loop cron interno (`setInterval` cada hora) `markExpiredRequests` que marca solicitudes `VENCIDA` cuando se pasa el plazo.
- `PatientDataRightsController` con: `POST /public/derechos` (publico, rate-limited 5/10min), y admin: `GET/PATCH/POST /admin/data-requests/...`.
- `PatientNotBlockedGuard` listo para usar en mutaciones clinicas (no aun aplicado a controllers existentes — ver pendientes).
- Modulo registrado en `AppModule`.

**Mail (`backend/src/mail/mail.service.ts`)** [CODIGO COMPLETO]:
- Agregados metodos: `sendDataRequestAcknowledgement`, `sendDataRequestResolved`, `sendDataRequestRejected`, `sendDataRequestExtended`, `sendBreachNotificationToSubject`. Reutiliza el transporte SMTP existente.

**Frontend** [CODIGO FUNCIONAL]:
- Pagina publica `frontend/src/app/derechos/page.tsx` + `DerechosForm.tsx` (react-hook-form + zod).
- Pagina admin `frontend/src/app/(dashboard)/admin/solicitudes/page.tsx` con lista filtrable, detalle modal, y acciones (marcar EN_REVISION, aplicar prorroga, resolver aceptar/rechazar).

**Docs**: `docs/operational-procedures-data-rights.md` CREADO con workflow detallado por tipo de derecho.

### Ola 3 — Cifrado app-level + NNA + Brechas (Arts 14 quinquies / 14 sexies / 16 quater) [COMPLETA EN CODIGO]

**Cifrado (`backend/src/common/utils/field-crypto.ts`)**:
- Agregados helpers binarios `encryptBuffer`, `decryptBuffer`, `isEncryptionEnvelope`, tipo `EncryptionEnvelope` (AES-256-GCM, v1).

**Snapshots regulatorios (`backend/src/patients/patients-regulatory-export.service.ts`)**:
- `snapshotForPurge` ahora cifra el ZIP cuando `ENCRYPTION_KEY` esta configurada y persiste `<filename>.enc` + `<filename>.envelope.json`. En dev sin clave, emite warning y persiste plaintext (modo dev/test).
- El bundle regulatorio descifra adjuntos cifrados antes de embeberlos en el ZIP.

**Attachments (`backend/src/attachments/`)**:
- `attachments.service.ts`: tras `validateFileContent` (magic-bytes), si `isEncryptionEnabled()` lee plaintext, cifra y reescribe disk; persiste `encryptionEnvelope` en la fila.
- `attachments.file-operations.ts`: `getAttachmentFile` retorna `{ path }` (plaintext) o `{ buffer }` (descifrado).
- `attachments.controller.ts`: download usa `res.end(buffer)` cuando esta cifrado, `res.sendFile(path)` en otro caso.
- Nueva columna en schema: `Attachment.encryptionEnvelope JSON`.

**NNA (Art 16 quater)** [CODIGO BACKEND COMPLETO; FRONTEND MINIMO]:
- Schema `Patient.legalRepresentative*` agregado (Ola 1).
- `PolicyComplianceService.assertNNAConsentValid` en `PatientConsentsService.grant`: rechaza consentimiento de paciente <16 anos si `signerRelationship === 'TITULAR'` (criterio conservador pendiente de validacion legal exacta — ver preguntas §2.3).
- Frontend: `nuevo.constants.ts` extendido con campos `legalRepresentative*` en el zod schema. UI manual en `pacientes/nuevo/page.tsx` NO extendida (pendiente).

**Brechas (Art 14 sexies)** [CODIGO COMPLETO]:
- Schema: `DataBreachIncident` con `detectedAt`, `severity`, `scope`, `affectedPatientIds JSON`, `rootCause`, `containmentActions`, `riskAssessment`, `reportedToAgencyAt`, `reportedToSubjectsAt`, `status`.
- `backend/src/data-breach/`: service + controller (admin-only) con endpoints `POST /admin/data-breaches`, `assess`, `notify-agency`, `notify-subjects`, `close`.
- `notifySubjects` itera sobre afectados con `Patient.email`, envia `MailService.sendBreachNotificationToSubject` y registra estadisticas.
- Modulo registrado en `AppModule`.

**Docs**:
- `docs/incident-runbook-data-breach.md` CREADO (criterios riesgo razonable, decisiones, plantillas, drill anual).
- `docs/programa-prevencion-infracciones.md` CREADO (Art 48 obligatorio, mapeo de cada infraccion tipo a accion preventiva implementada).

### Ola 4 — Madurez + Go/No-Go [DOCS COMPLETOS; DRILLS STUB]

- `docs/modelo-cumplimiento-voluntario.md` CREADO (Art 49/51 estructura completa con 7 elementos del Art 49 mapeados a implementacion actual).
- `backend/scripts/drills/dsar-drill.js` CREADO (drill end-to-end de solicitud publica de acceso; implementacion parcial — pasos admin pendientes de credenciales).
- `backend/scripts/drills/breach-drill.js` CREADO (stub con descripcion de pasos pendientes).

### Verificacion final

- `npx prisma validate`: OK
- `npx tsc --noEmit -p tsconfig.json` (backend): OK
- `npx tsc --noEmit -p tsconfig.json` (frontend): OK
- `prisma migrate dev --create-only` genero `20260523053538_ley21719_compliance_full` (no aplicada).
- Seed actualizado corre OK contra la DB dev (crea 3 documentos legales: TERMS, PRIVACY 2026-05-02, PRIVACY 1.0-DRAFT).

### Faltante (post-implementacion)

#### Bloqueado en asesor legal externo
1. Texto definitivo de la **Politica de Privacidad v1.0** que reemplace todos los `[PENDIENTE_ABOGADO]` de `backend/prisma/seed.ts` (`legal-privacy-v1-draft`). Hoy el doc esta en `status: 'DRAFT'`.
2. Validacion de la **DPIA** (`docs/dpia-2026.md`) y firma.
3. Validacion del **RAT** (`docs/data-processing-register.md`) y firma.
4. Confirmacion de **plazos de retencion sanitaria** especificos por categoria (la app asume 15 anos como default).
5. Confirmacion de criterios precisos de **Art 16 quater** (edades, validacion vinculo del representante).
6. Firma de **DPAs** con subencargados reales (Cloudflare, Sentry, SMTP provider, hosting).
7. Modelo y plantilla para reporte formal a la **Agencia de Proteccion de Datos** (canal pendiente hasta que la Agencia se constituya).
8. Definicion de **sanciones internas** por incumplimiento (RRHH + abogado).

#### Bloqueado en decisiones operativas
1. Activar `REGULATORY_CONSENT_ENFORCEMENT=hard` en produccion (hoy default `soft` para no romper pacientes preexistentes).
2. Designacion **formal** del DPO (Alejandro como interino esta documentado; falta acto formal segun lo que el abogado defina).
3. Capacitacion al personal sanitario (programa anual O1 de `programa-prevencion-infracciones.md`).
4. Inventario real de **transferencias internacionales** con paises confirmados por cada subencargado.

#### Pendiente en codigo (follow-up natural)
1. **Aplicar la migracion Prisma** `20260523053538_ley21719_compliance_full` con `npx prisma migrate dev`. Esto **DROPEA** `informed_consents`. Confirmar antes con el user en cada entorno.
2. **Aplicar `PatientNotBlockedGuard`** a los controllers clinicos que mutan datos (encounters, sections, attachments, alerts, problems). Pattern: agregar `@UseGuards(JwtAuthGuard, PatientNotBlockedGuard)` y asegurar que el endpoint expone `patientId` en params o body.
3. **Aplicar `PolicyComplianceService.assertConsentFor()`** en `PatientsService.create/update` y en el flujo de inicio de Encounter (con purpose `ATENCION_CLINICA`).
4. **Frontend NNA**: extender `pacientes/nuevo/page.tsx` y `pacientes/[id]/editar/EditarPacienteFormSections.tsx` con los inputs de representante legal cuando `fechaNacimiento` indica menor de 18 anos (el zod schema ya soporta los campos).
5. **Frontend consent tab**: extender `frontend/src/components/PatientConsents.tsx` con tab dedicado "Tratamiento de datos" que invoque `POST /patient-consents/grant` y renderice la version vigente de la politica desde `LegalDocumentPage.tsx`.
6. **Cifrado app-level para Patient identificatorios** (RUT, nombre, telefono, email, domicilio, contactoEmergencia). NO implementado en esta tanda por su complejidad (requiere refactor de presenters y queries que filtran por estos campos como `rut UNIQUE`). El Gate 4 del Go/No-Go lo exige antes de tratar datos reales. Aprobar enfoque: columnas `*_enc` + lookup hashes para campos UNIQUE.
7. **Reemplazar `setInterval` por `@nestjs/schedule`** en `DataRequestSlaService` si se justifica para mejor manejo de lifecycle / disponibilidad.
8. **Implementar bloqueo/desbloqueo desde la UI admin** (hoy el guard funciona, pero la UI para que el DPO active/desactive `Patient.blockedAt` es manual via PATCH /api/patients/:id).
9. **Tests unitarios y E2E** para los modulos nuevos (`patient-consents`, `patient-data-rights`, `data-breach`) — esta tanda solo verifico compilacion + prisma validate.
10. **Completar drill scripts** `dsar-drill.js` y `breach-drill.js` para que ejecuten el flujo admin con login real y reporten timing.
11. **Endpoint admin de bloqueo/desbloqueo de paciente** dedicado (`POST /admin/patients/:id/block` con DTO de reason) en vez de PATCH generico.
12. **Auditoria de impacto del rename `InformedConsent` → `ClinicalConsent`** en clientes frontend y archivos no-backend que pudieran usar el nombre legacy (no detectados, pero conviene grep en frontend cuando se aplique la migracion).

#### Pendiente en pruebas
1. Drill cronometrado de brecha (objetivo <72h del runbook).
2. Drill end-to-end de solicitud de acceso del titular (objetivo cumplir SLA Art 11).
3. Restore drill desde backup Postgres cifrado.
4. Verificacion de `audit:integrity:verify --full` despues de aplicar la migracion y operar las nuevas entidades.

### Archivos creados en esta tanda

- `docs/architecture-decisions/002-ley-21719-compliance.md`
- `docs/preguntas-abogado-ley21719.md`
- `docs/dpia-2026.md`
- `docs/data-processing-register.md`
- `docs/operational-procedures-data-rights.md`
- `docs/incident-runbook-data-breach.md`
- `docs/programa-prevencion-infracciones.md`
- `docs/modelo-cumplimiento-voluntario.md`
- `backend/src/patient-consents/dto/patient-consent.dto.ts`
- `backend/src/patient-consents/patient-consents.service.ts`
- `backend/src/patient-consents/patient-consents.controller.ts`
- `backend/src/patient-consents/patient-consents.module.ts`
- `backend/src/patient-consents/policy-compliance.service.ts`
- `backend/src/patient-data-rights/dto/patient-data-rights.dto.ts`
- `backend/src/patient-data-rights/patient-data-rights.service.ts`
- `backend/src/patient-data-rights/patient-data-rights.controller.ts`
- `backend/src/patient-data-rights/patient-data-rights.module.ts`
- `backend/src/patient-data-rights/patient-not-blocked.guard.ts`
- `backend/src/data-breach/dto/data-breach.dto.ts`
- `backend/src/data-breach/data-breach.service.ts`
- `backend/src/data-breach/data-breach.controller.ts`
- `backend/src/data-breach/data-breach.module.ts`
- `backend/scripts/drills/dsar-drill.js`
- `backend/scripts/drills/breach-drill.js`
- `frontend/src/app/derechos/page.tsx`
- `frontend/src/app/derechos/DerechosForm.tsx`
- `frontend/src/app/(dashboard)/admin/solicitudes/page.tsx`
- `backend/prisma/migrations/20260523053538_ley21719_compliance_full/migration.sql` (no aplicada)

### Archivos modificados

- `backend/prisma/schema.prisma` (rename + 3 nuevas entidades + campos Patient/Attachment)
- `backend/prisma/seed.ts` (politica v1.0 draft + soporte de status explicito)
- `backend/src/app.module.ts` (registrar PatientConsentsModule, PatientDataRightsModule, DataBreachModule)
- `backend/src/common/types/index.ts` (nuevos AuditReasons)
- `backend/src/audit/audit-catalog.ts` (etiquetas + inferencia)
- `backend/src/audit/audit-helpers.ts` (CLINICAL_ENTITY_TYPES amplia)
- `backend/src/common/utils/field-crypto.ts` (helpers binarios)
- `backend/src/mail/mail.service.ts` (5 metodos nuevos)
- `backend/src/patients/patients-regulatory-export.service.ts` (cifrado snapshot + descifrado attachments)
- `backend/src/attachments/attachments.service.ts` (cifrado at-upload)
- `backend/src/attachments/attachments.file-operations.ts` (descifrado at-download)
- `backend/src/attachments/attachments.controller.ts` (sendFile vs buffer)
- `backend/src/consents/*` (rename Prisma `informedConsent` → `clinicalConsent`)
- `frontend/src/app/(dashboard)/pacientes/nuevo/nuevo.constants.ts` (campos legalRepresentative*)
- 10 archivos mas con replace masivo `'InformedConsent'` → `'ClinicalConsent'`.


