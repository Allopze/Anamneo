# Auditoria visual de screenshots e2e

Revision realizada sobre `frontend/tests/e2e/screenshots/` el 2026-06-02. Se revisaron 75 capturas: desktop interno, mobile interno, portal paciente y flujos publicos/legal.

## Estado de avance

- Corregido y verificado: overflow de `atenciones__ficha--mobile.png` en la barra de acciones superior.
- Corregido y verificado: tabla de `portal__historial-acceso--mobile.png` ahora declara y permite desplazamiento horizontal.
- Corregido y verificado: `portal__atencion-detail--desktop/mobile.png` deja de mostrar JSON crudo y renderiza campos clinicos legibles.
- Corregido y verificado: `admin__auditoria--desktop.png` usa tabla con ancho minimo, cabecera completa y region desplazable.
- Corregido y verificado: filtros de auditoria, seguimientos, historial clinico y nuevo paciente ajustan anchos/textos para evitar truncamientos.
- Corregido y verificado: contador del header de catalogo cambia entre `Afecciones` y `Medicamentos`.
- Corregido y verificado: spec visual descarta el modal de onboarding medico antes de capturar.
- Corregido y verificado: spec visual crea paciente con `sexo: MASCULINO` para evitar caer en `/pacientes` al capturar detalle.
- Corregido y verificado: `atenciones__list--desktop.png` se captura con sesion medica cuando exista, evitando redireccion visual a dashboard admin.
- Corregido y verificado: specs visuales esperan la desaparicion de skeletons antes de capturar.
- Corregido y verificado: `plantillas__list--mobile.png` vuelve a usar la barra secundaria del shell interno.
- Corregido y verificado: portal home baja el peso visual de `Salir` y portal solicitudes recupera header de portal.
- Corregido y verificado: textarea de portal solicitudes usa radio menor y `public__descargar-ficha--desktop.png` queda centrada como las utilitarias publicas.
- Corregido y verificado: `agenda__week--desktop.png` conserva titulo/contexto de pagina incluso en estado sin medico asignado.
- Corregido y verificado: `dashboard__admin--desktop/mobile.png` reduce la escala del hero operativo.
- Corregido y verificado: `pacientes__admin--desktop.png` compacta la columna de actividad operativa.
- Corregido y verificado: `pacientes__edit--desktop.png` deja el footer de acciones en flujo normal, evitando que tape campos en desktop bajo o mobile.
- Corregido y verificado: `portal__atencion-detail--desktop/mobile.png` traduce labels clinicos comunes y oculta metadatos internos como `readonly`.
- Corregido y verificado: `admin__solicitudes--desktop.png` integra el filtro `Estado` en una banda de filtros bajo el header.
- Corregido y verificado: `plantillas__list--desktop.png` estabiliza el ancho de acciones de header.
- Corregido y verificado: `ajustes__perfil--desktop.png` y `ajustes__sistema--desktop.png` usan tabs con ancho minimo estable.
- Corregido y verificado: `ajustes__sistema--desktop.png` alinea el estado `Con alertas` junto al titulo del panel.
- Corregido y verificado: badge rojo de `Auditoria` en sidebar baja peso visual cuando la seccion no esta activa.
- Corregido y verificado: `atenciones__detail--mobile.png` oculta separadores de metadata en mobile para evitar wraps asimetricos.
- Corregido y verificado: `atenciones__detail--desktop.png` da scroll interno al rail de secciones para que no parezca cortado.
- Corregido y verificado: `portal__login` adopta la misma familia visual de `public__login` mediante `AuthFrame`.
- Corregido y verificado: `public__derechos` y `portal__solicitudes` comparten carcasa visual de solicitud de datos.
- Corregido y verificado: `legal__privacidad` y `legal__terminos` renderizan siempre una matriz estructural equivalente.
- Corregido y verificado: los inputs de fecha visibles usan formato `dd-mm-aaaa` con valor interno `yyyy-mm-dd`.
- Corregido y verificado: admin y ajustes heredan la topbar global del shell.

## Verificacion final

- `npm --prefix frontend run typecheck`: OK.
- `npm --prefix frontend run test`: OK, 74 suites y 365 tests.
- `npm --prefix frontend run test:e2e:visual`: OK, 41 pruebas visuales.
- Verificacion manual puntual posterior: `atenciones__ficha--mobile.png`, `pacientes__edit--desktop.png`, `portal__atencion-detail--mobile.png`, `admin__auditoria--desktop.png`, `admin__solicitudes--desktop.png`, `atenciones__detail--desktop/mobile.png`, `portal__login--desktop.png`, `public__derechos--desktop/mobile.png`, `portal__solicitudes--desktop.png`, `legal__privacidad--desktop.png`, `legal__terminos--desktop.png`, `pacientes__new--mobile.png`, `admin__usuarios--desktop.png` y `ajustes__sistema--desktop.png`.

## Faltante y siguientes pasos naturales

- Faltante funcional de esta ronda: ninguno detectado despues de typecheck, unit tests y suite visual.
- Siguiente paso recomendado: convertir los patrones que se repitieron en esta ronda en reglas de componentes: tablas anchas con scroll declarado, filtros con anchos minimos por idioma, headers mobile sin separadores fragiles, fechas localizadas y acciones icon-only con nombre accesible estable.
- Siguiente paso recomendado: evaluar si `legal__privacidad` debe usar filas genericas como `legal__terminos` o conservar su fila especifica de categorias de datos. Ambas paginas ya comparten estructura visual; la diferencia actual es semantica.

## Hallazgos criticos

| Dispositivo | Seccion | Screenshot | Inconsistencia visual o asimetria |
|---|---|---|---|
| Mobile | Atenciones, ficha previa a firma | `frontend/tests/e2e/screenshots/atenciones__ficha--mobile.png` | La accion `Firmar` queda cortada contra el borde izquierdo. La barra de acciones superior desborda horizontalmente y oculta parte del primer boton. |
| Desktop | Pacientes, editar paciente | `frontend/tests/e2e/screenshots/pacientes__edit--desktop.png` | La barra fija inferior de acciones se superpone al formulario. El campo siguiente queda parcialmente cubierto, sin espacio reservado bajo el contenido. |
| Mobile | Portal, historial de accesos | `frontend/tests/e2e/screenshots/portal__historial-acceso--mobile.png` | La tabla solo muestra `Fecha y hora`, `Seccion` y `Accion`. Las columnas `Actor` y `Resultado`, visibles en desktop, quedan fuera de la captura sin affordance visual clara de scroll horizontal. |
| Desktop | Portal, ficha de atencion | `frontend/tests/e2e/screenshots/portal__atencion-detail--desktop.png` | La ficha clinica se muestra como bloques JSON crudos con etiquetas en mayusculas. Visualmente no coincide con la ficha clinica interna ni con el lenguaje sobrio de datos clinicos ya usado en el producto. |
| Mobile | Portal, ficha de atencion | `frontend/tests/e2e/screenshots/portal__atencion-detail--mobile.png` | El problema del JSON crudo se agrava: los bloques monoespaciados fuerzan cortes raros de linea y hacen que la lectura clinica parezca tecnica/debug. |

## Hallazgos altos

| Dispositivo | Seccion | Screenshot | Inconsistencia visual o asimetria |
|---|---|---|---|
| Desktop | Atenciones, lista | `frontend/tests/e2e/screenshots/atenciones__list--desktop.png` | La captura no muestra una lista de atenciones, sino una pantalla de dashboard administrativo. Es una inconsistencia de estado/cobertura visual para esa seccion. |
| Desktop | Pacientes, detalle | `frontend/tests/e2e/screenshots/pacientes__detail--desktop.png` | La captura luce como la lista de pacientes, no como una ficha detalle. Aunque no es identica por hash a `pacientes__list--desktop.png`, visualmente cubre el mismo estado de lista. |
| Desktop | Dashboard medico | `frontend/tests/e2e/screenshots/dashboard__medico--desktop.png` | La captura esta tomada con el modal de onboarding abierto y el dashboard desenfocado. No es comparable con `dashboard__admin--desktop.png`, que muestra la pantalla base. |
| Desktop | Reportes operacionales | `frontend/tests/e2e/screenshots/reportes__list--desktop.png` | La pantalla queda en estado skeleton/cargando, mientras otras secciones listan contenido o vacios finales. Esto rompe la consistencia de estados capturados. |
| Mobile | Reportes operacionales | `frontend/tests/e2e/screenshots/reportes__list--mobile.png` | Igual que desktop: la captura queda en skeleton largo, sin estado final ni mensaje de carga. |
| Desktop | Auditoria | `frontend/tests/e2e/screenshots/admin__auditoria--desktop.png` | La tabla inferior se corta hacia la derecha: columnas como `Request ID` quedan truncadas y no se ve un contenedor o affordance de scroll horizontal. |
| Desktop | Auditoria, filtros | `frontend/tests/e2e/screenshots/admin__auditoria--desktop.png` | El campo `Request ID` muestra placeholder cortado (`Correlaci...`) y los filtros de fecha se ven apretados, con iconos pegados al texto. |
| Desktop | Catalogo, medicamentos | `frontend/tests/e2e/screenshots/catalogo__medicamentos--desktop.png` | El contador superior sigue diciendo `40 Afecciones` aunque la pestaña activa sea `Medicamentos`. La navegacion superior comunica un estado cruzado. |
| Mobile | Catalogo, medicamentos | `frontend/tests/e2e/screenshots/catalogo__medicamentos--mobile.png` | El contador superior tambien queda como `40` sin contexto de medicamentos, generando asimetria con la pestaña activa. |
| Desktop | Seguimientos, filtros | `frontend/tests/e2e/screenshots/seguimientos__list--desktop.png` | El buscador y algunos selects quedan demasiado estrechos: `Buscar por tare...` y `Todas las priori...` aparecen truncados. |
| Desktop | Nuevo paciente | `frontend/tests/e2e/screenshots/pacientes__new--desktop.png` | El campo `Edad calculada` queda demasiado estrecho y corta el texto (`Completa la fecha de...`). |
| Desktop | Historial clinico | `frontend/tests/e2e/screenshots/pacientes__history--desktop.png` | El buscador de `Uso de medicamentos` corta el placeholder al final (`...medicamento habit`). |
| Mobile | Historial clinico | `frontend/tests/e2e/screenshots/pacientes__history--mobile.png` | El input de catalogo corta el placeholder `Selecciona o escribe afeccion...`; el texto queda comprimido dentro del control. |

## Hallazgos medios

| Dispositivo | Seccion | Screenshot | Inconsistencia visual o asimetria |
|---|---|---|---|
| Desktop | Catalogo, Afecciones vs Medicamentos | `catalogo__afecciones--desktop.png`, `catalogo__medicamentos--desktop.png` | Las acciones principales tienen geometria distinta entre pestañas hermanas: en Afecciones `Nueva afeccion` e `Importar CSV` van en linea; en Medicamentos se apilan verticalmente. |
| Mobile | Catalogo, Afecciones vs Medicamentos | `catalogo__afecciones--mobile.png`, `catalogo__medicamentos--mobile.png` | La misma asimetria se repite en mobile: Afecciones mantiene acciones en una fila, Medicamentos las apila en dos lineas. |
| Mobile | App interna, barra secundaria | Multiples internas: `analitica__casos--mobile.png`, `atenciones__new--mobile.png`, `pacientes__new--mobile.png`, `plantillas__list--mobile.png` | Algunas pantallas muestran una barra secundaria de iconos bajo el header y otras no. Esto cambia el punto de arranque del contenido y hace que secciones hermanas parezcan tener shells distintos. |
| Desktop | App interna, header superior | Multiples internas | Hay pantallas con topbar global (`agenda`, `reportes`, `seguimientos`, `catalogo`, `pacientes`) y otras que arrancan directo con titulo (`admin__solicitudes`, `admin__usuarios`, `ajustes`). La jerarquia superior no es uniforme. |
| Desktop | Agenda | `frontend/tests/e2e/screenshots/agenda__week--desktop.png` | La vista vacia no muestra titulo de pagina, solo topbar y empty state centrado. Contrasta con otras pantallas vacias que conservan encabezado o contexto de seccion. |
| Desktop | Admin solicitudes | `frontend/tests/e2e/screenshots/admin__solicitudes--desktop.png` | El filtro `Todas` flota a la derecha del titulo, separado del bloque de tabla. Visualmente parece pertenecer a otra fila y deja un gran vacio entre header y contenido. |
| Desktop | Plantillas | `frontend/tests/e2e/screenshots/plantillas__list--desktop.png` | Las acciones de header estan alineadas arriba a la derecha, mientras el empty state queda en un panel muy ancho. En mobile el mismo empty state se presenta como tarjeta compacta; la densidad cambia mucho. |
| Mobile | Plantillas | `frontend/tests/e2e/screenshots/plantillas__list--mobile.png` | No aparece la barra secundaria de iconos que si se usa en otras pantallas internas mobile, aunque pertenece al mismo shell de app. |
| Desktop | Dashboard admin | `frontend/tests/e2e/screenshots/dashboard__admin--desktop.png` | La tarjeta hero es mucho mas grande y aireada que el resto de paneles operativos; genera una escala visual distinta a otras pantallas administrativas mas densas. |
| Mobile | Dashboard admin | `frontend/tests/e2e/screenshots/dashboard__admin--mobile.png` | El titulo `Buenas tardes, Admin` se parte en dos lineas con escala muy grande para dashboard operativo, ocupando mucho primer viewport frente a controles y estados. |
| Desktop | Pacientes admin | `frontend/tests/e2e/screenshots/pacientes__admin--desktop.png` | La columna lateral de `Actividad operativa` queda cortada al fondo de la captura; el ultimo bloque empieza pero no termina. |
| Mobile | Pacientes admin | `frontend/tests/e2e/screenshots/pacientes__admin--mobile.png` | El boton `Volver a pacientes` ocupa una fila completa y separa demasiado los chips de estado de los datos. En desktop es una accion compacta a la derecha. |
| Desktop | Ajustes, tabs | `ajustes__perfil--desktop.png`, `ajustes__sistema--desktop.png` | Las tabs activas usan una pildora blanca de ancho variable. Entre `Perfil y seguridad` y `Sistema` cambia mucho el peso visual de la tab activa, aunque es la misma navegacion. |
| Desktop | Ajustes sistema | `frontend/tests/e2e/screenshots/ajustes__sistema--desktop.png` | La etiqueta `Con alertas` queda en la esquina superior derecha del card principal, separada del titulo y sin alinearse con el grid de informacion. |
| Mobile | Atenciones detalle | `frontend/tests/e2e/screenshots/atenciones__detail--mobile.png` | La cabecera de datos (`Atencion`, `Sin RUT`, fecha, duracion) se envuelve en varias lineas y queda menos estructurada que en desktop. Los separadores tipo punto pierden simetria al partirse. |
| Desktop | Atenciones detalle | `frontend/tests/e2e/screenshots/atenciones__detail--desktop.png` | La columna de secciones se corta en el borde inferior de la captura, mientras el panel derecho sigue con contenido. La navegacion lateral de secciones no deja claro que continua. |

## Hallazgos bajos

| Dispositivo | Seccion | Screenshot | Inconsistencia visual o asimetria |
|---|---|---|---|
| Desktop | Sidebar interna | Multiples internas | El indicador rojo de `Auditoria` aparece aun cuando `Auditoria` no es la seccion activa. Es consistente como alerta, pero visualmente compite con el estado activo lima en todas las pantallas. |
| Desktop | Sidebar interna | Multiples internas | El logo en sidebar tiene un punto lima muy pequeno bajo el icono. Se percibe como artefacto o pixel suelto mas que como parte intencional de marca. |
| Mobile | App interna | Multiples internas | El header principal usa margen horizontal distinto al de la barra secundaria y al contenido en varias pantallas. La app se siente como capas con anchos levemente diferentes. |
| Mobile | Nuevo paciente | `frontend/tests/e2e/screenshots/pacientes__new--mobile.png` | El placeholder de fecha aparece como `mm/dd/yyyy`, desalineado con el resto del producto en espanol y con fechas mostradas en formato `dd-mm-yyyy` en otras pantallas. |
| Desktop | Portal paciente home | `frontend/tests/e2e/screenshots/portal__home--desktop.png` | El header del portal usa botones a la derecha, pero `portal__solicitudes--desktop.png` pasa a tarjeta centrada sin el mismo marco de navegacion. |
| Mobile | Portal paciente home | `frontend/tests/e2e/screenshots/portal__home--mobile.png` | Los botones `Solicitudes`, `Historial de accesos` y `Salir` se distribuyen en dos filas; `Salir` queda solo y con mas peso visual del esperado para una accion secundaria. |
| Desktop | Portal solicitudes | `frontend/tests/e2e/screenshots/portal__solicitudes--desktop.png` | La tarjeta de formulario usa un textarea muy redondeado y grande, mas cercano a una pildora que a un campo de texto largo. En mobile se siente todavia mas pronunciado. |
| Mobile | Portal solicitudes | `frontend/tests/e2e/screenshots/portal__solicitudes--mobile.png` | El textarea mantiene radios muy grandes y ocupa un bloque visual pesado frente a inputs mas sobrios. |
| Desktop | Publico, utilitarias | `public__forgot-password--desktop.png`, `public__change-password-invalid-token--desktop.png`, `public__descargar-ficha--desktop.png` | Las tarjetas de tareas hermanas no comparten posicion vertical: recuperar e invalid-token estan centradas, descarga de ficha queda mucho mas arriba. |
| Mobile | Publico, utilitarias | `public__forgot-password--mobile.png`, `public__change-password-invalid-token--mobile.png` | Las tarjetas estan centradas verticalmente, pero no comparten el lenguaje visual mas completo de `public__login--mobile.png` y `public__register--mobile.png` con hero/logo. |
| Desktop/Mobile | Portal login vs Public login | `portal__login--desktop.png`, `portal__login--mobile.png`, `public__login--desktop.png`, `public__login--mobile.png` | Hay dos lenguajes para accesos externos: portal minimo gris y public con hero, marca, teal e iconografia. Si ambos son puertas de acceso relacionadas, se sienten como productos distintos. |
| Desktop | Legal privacidad vs terminos | `legal__privacidad--desktop.png`, `legal__terminos--desktop.png` | `Privacidad` tiene una fila tipo matriz `Pacientes` adicional antes del cuerpo; `Terminos` pasa directo a contenido. Puede ser editorialmente correcto, pero visualmente desbalancea documentos hermanos. |
| Desktop/Mobile | Public derechos vs Portal solicitudes | `public__derechos--desktop.png`, `public__derechos--mobile.png`, `portal__solicitudes--desktop.png`, `portal__solicitudes--mobile.png` | Son formularios para solicitudes de datos, pero usan estructuras diferentes: public usa copy legal largo y tarjeta completa; portal usa formulario compacto con link superior. La relacion entre ambos flujos no se percibe visualmente. |

## Patrones transversales

- Hay inconsistencias de shell: la app interna alterna entre pantallas con topbar global, sin topbar, con barra secundaria mobile y sin barra secundaria mobile.
- Varios controles no estan dimensionados para textos reales en espanol, especialmente filtros, placeholders de busqueda y campos calculados.
- Las tablas anchas no tienen una solucion mobile consistente. En portal historial se pierden columnas; en auditoria desktop se cortan columnas.
- Algunas capturas parecen estados incorrectos o no estabilizados: lista de atenciones mostrando dashboard, detalle de pacientes mostrando lista, dashboard medico con modal y reportes en skeleton.
- Los flujos externos usan tres lenguajes visuales: public hero teal, portal gris minimalista y legales/editoriales. Conviene definir si son familias separadas o si deben converger.
