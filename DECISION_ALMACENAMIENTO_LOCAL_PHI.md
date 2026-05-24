# Decision de producto y seguridad: almacenamiento local de PHI

Fecha: 2026-05-24  
Estado: pendiente de decision formal del equipo  
Alcance: borradores de atencion, copias recuperables de conflictos y cola offline del frontend.

## Contexto

Anamneo maneja informacion clinica sensible, incluyendo datos identificatorios, motivos de consulta, anamnesis, examenes, tratamientos, adjuntos y estados legales del paciente. Parte de la experiencia clinica depende de resiliencia local: no perder texto durante una consulta, recuperar conflictos y encolar cambios cuando la red falla.

Esa resiliencia tiene un costo: cualquier dato guardado por el navegador puede quedar en disco del equipo, en respaldos del perfil del navegador o disponible para otra persona que use la misma sesion del sistema operativo. En una consulta real esto importa mucho porque los equipos pueden ser compartidos entre medico, asistente, administracion o turnos.

La implementacion actual queda en una postura conservadora:

- `sharedDeviceMode` esta activo por defecto salvo `NEXT_PUBLIC_DEFAULT_SHARED_DEVICE_MODE=false`.
- Cuando `sharedDeviceMode` esta activo, no se guardan drafts, conflictos ni cola offline local.
- Cuando se permite persistencia local, los drafts y conflictos se cifran antes de escribirse en `localStorage`.
- La cola offline cifra el payload clinico antes de escribirlo en IndexedDB.
- La clave de cifrado es de sesion del navegador, guardada en `sessionStorage`; esto reduce exposicion ante lectura directa de `localStorage`/IndexedDB, pero no protege contra XSS activo ni contra un perfil de navegador comprometido durante la sesion.

## Decision que falta

El equipo debe decidir si Anamneo ofrecera persistencia local de PHI como capacidad soportada, y bajo que condiciones. Esta no es solo una decision tecnica: afecta soporte, capacitacion, cumplimiento, UX, respuesta ante incidentes y promesas comerciales.

La decision recomendada por defecto es:

> En entornos clinicos o equipos compartidos, mantener `sharedDeviceMode=true` y desactivar persistencia local de PHI. Permitir drafts/offline solo en equipos personales o administrados, con aprobacion explicita de la organizacion y mensaje visible para el usuario.

## Opciones

### Opcion A: prohibir persistencia local de PHI

El modo compartido queda forzado por variable de entorno o politica organizacional. No hay drafts locales, cola offline ni recuperacion local de conflictos.

Ventajas:

- Menor superficie de privacidad.
- Mas facil de explicar en auditoria.
- Menor riesgo en equipos compartidos.
- Menos incidentes por sesiones abiertas.

Costos:

- Peor tolerancia a cortes de red.
- Mas frustracion si el navegador se cierra o falla una consulta larga.
- Menos diferenciacion UX.

Usar cuando:

- La clinica opera con estaciones compartidas.
- No hay gestion de dispositivos.
- La red es razonablemente estable.
- El responsable de seguridad prefiere minimizacion estricta.

### Opcion B: permitir persistencia local cifrada por sesion

La app permite drafts/offline en equipos no compartidos. El payload se cifra con WebCrypto y la clave vive en `sessionStorage`.

Ventajas:

- Reduce exposicion de lectura directa de `localStorage`/IndexedDB.
- Mantiene recuperacion durante una sesion o recarga de pestana.
- No requiere servidor adicional ni custodia remota de claves.

Costos:

- No protege contra XSS activo.
- No equivale a cifrado fuerte contra un perfil local comprometido.
- Si se pierde la clave de sesion, la app no debe intentar recuperar datos antiguos.
- Requiere microcopy y soporte claros.

Usar cuando:

- El equipo es personal o administrado.
- Hay cierre automatico de sesion y bloqueo del sistema operativo.
- La organizacion acepta el riesgo residual.

### Opcion C: persistencia local cifrada con clave derivada del login

La app deriva o recibe una clave que permite recuperar drafts entre sesiones.

Ventajas:

- Mejor UX de recuperacion real entre sesiones.
- Puede mantener offline robusto.

Costos:

- Mucha mas complejidad criptografica y operacional.
- Riesgo de disenar mal la gestion de claves.
- Requiere modelo formal de amenaza, rotacion, logout, cambio de password y recuperacion.

No recomendada ahora. Solo considerarla si offline persistente es un diferenciador critico y el equipo esta dispuesto a invertir en diseno criptografico y pruebas dedicadas.

## Preguntas dirigidas al dev

1. Que tipo de equipo debemos asumir por defecto: personal del medico, estacion compartida de box, notebook administrado por clinica o computador domestico?
2. Existe una politica real de bloqueo de pantalla, usuarios del sistema operativo separados y cierre de sesion al terminar turno?
3. El producto necesita prometer trabajo offline, o basta con tolerar cortes breves durante una misma sesion?
4. Cuanto tiempo maximo es aceptable retener drafts locales: minutos, horas, 24 horas o nunca?
5. Debe poder recuperarse un draft despues de cerrar completamente el navegador, o solo tras recargar la pestana?
6. Que rol puede activar persistencia local: usuario individual, admin de clinica, variable de despliegue o nadie?
7. Como debe comunicarse en UI que hay datos clinicos guardados localmente en este equipo?
8. Al hacer logout, cambio de usuario, firma de atencion o bloqueo temporal del paciente, se deben purgar todos los datos locales relacionados?
9. Si falla WebCrypto, preferimos perder la capacidad offline o caer a persistencia plaintext? Recomendacion: fallar cerrado.
10. El soporte tecnico tendra instrucciones para purgar `localStorage`, `sessionStorage` e IndexedDB ante incidente o equipo compartido mal configurado?
11. Esta decision debe registrarse por clinica como parte de onboarding y consentimiento contractual?
12. Que evidencia necesitara auditoria: variable de entorno, captura de UI, log de cambio de preferencia, procedimiento operativo o todo lo anterior?

## Recomendacion operativa

Para la siguiente version sensible, usar esta politica:

- Produccion general: `sharedDeviceMode=true` por defecto.
- Equipos administrados y personales: permitir opt-in explicito por admin de clinica.
- Persistencia local: cifrada por sesion, TTL maximo 24 horas, purga en logout/cambio de usuario/firma.
- Sin WebCrypto: no persistir localmente.
- UI: mostrar un indicador sobrio cuando exista borrador o cola offline local.
- Runbook: incluir purga local en procedimientos de soporte e incidente.

## Riesgo residual

El cifrado local reduce la exposicion accidental en disco, pero no elimina el riesgo de:

- XSS activo durante la sesion.
- Malware local o navegador comprometido.
- Usuario del sistema operativo compartido sin bloqueo.
- Backups del perfil del navegador durante una sesion abierta.
- Captura de pantalla, extensiones o herramientas de soporte remoto.

Por eso la decision final debe combinar controles tecnicos, politica de dispositivo y capacitacion.
