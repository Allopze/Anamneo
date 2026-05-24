# Decision de producto y seguridad: almacenamiento local de PHI

Fecha: 2026-05-24  
Estado: decision adoptada para uso personal / despliegue controlado de baja escala  
Alcance: borradores de atencion, copias recuperables de conflictos y cola offline del frontend.

## Contexto

Anamneo maneja informacion clinica sensible, incluyendo datos identificatorios, motivos de consulta, anamnesis, examenes, tratamientos, adjuntos y estados legales del paciente. Parte de la experiencia clinica depende de resiliencia local: no perder texto durante una consulta, recuperar conflictos y encolar cambios cuando la red falla.

Esa resiliencia tiene un costo: cualquier dato guardado por el navegador puede quedar en disco del equipo, en respaldos del perfil del navegador o disponible para otra persona que use la misma sesion del sistema operativo. En una consulta real esto importa mucho porque los equipos pueden ser compartidos entre medico, asistente, administracion o turnos.

La implementacion actual queda en una postura conservadora por defecto, con opt-in explicito:

- `sharedDeviceMode` esta activo por defecto salvo `NEXT_PUBLIC_DEFAULT_SHARED_DEVICE_MODE=false`.
- Cuando `sharedDeviceMode` esta activo, no se guardan drafts, conflictos ni cola offline local.
- Cuando se permite persistencia local, los drafts y conflictos se cifran antes de escribirse en `localStorage`.
- La cola offline cifra el payload clinico antes de escribirlo en IndexedDB.
- La clave de cifrado es persistente del navegador, guardada en `localStorage`, para poder recuperar un draft despues de cerrar completamente el navegador.
- Este diseno reduce exposicion ante lectura casual de payloads de drafts/IndexedDB, pero no protege contra XSS activo, extensiones maliciosas, malware local ni un perfil de navegador comprometido. Al persistir la clave, tambien existe riesgo si se copia o respalda completo el perfil del navegador.

## Decision adoptada

Para el estado actual de Anamneo, que es un proyecto personal alojado en infraestructura propia y potencialmente usado por una sola persona de confianza, se permite persistencia local cifrada de PHI bajo estas condiciones:

- Activacion solo por variable de despliegue o admin: `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=false` y politica local equivalente.
- TTL maximo de drafts y conflictos: 24 horas.
- Recuperacion tras cerrar el navegador: permitida, porque el objetivo explicito es no perder una atencion larga ante cierre accidental.
- Falla de WebCrypto: fallar cerrado, sin fallback plaintext.
- Equipos compartidos o clinicos reales: mantener `sharedDeviceMode=true` y no prometer offline persistente.
- Logout/cambio de usuario: por ahora se mantiene purga conservadora de estado local para reducir riesgo de privacidad. La excepcion "solo si ya esta en servidor" requiere una bitacora local de sincronizacion por entidad antes de implementarse con seguridad.
- UI: no mostrar advertencias tecnicas permanentes al medico; mantener indicadores operativos de borrador/pendiente/conflicto. Si Anamneo pasa a uso clinico real, agregar texto de onboarding para admin y procedimiento de dispositivo.
- Evidencia operativa minima: guardar esta decision, documentar variables `.env`, y repetir validacion antes de usar datos reales o compartir el equipo.

Esta decision no equivale a una autorizacion para operar en clinicas con estaciones compartidas. En ese escenario la decision recomendada vuelve a ser:

> En entornos clinicos o equipos compartidos, mantener `sharedDeviceMode=true` y desactivar persistencia local de PHI. Permitir drafts/offline solo en equipos personales o administrados, con aprobacion explicita de la organizacion y procedimiento visible para administracion.

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

### Opcion B: permitir persistencia local cifrada en el navegador

La app permite drafts/offline en equipos no compartidos. El payload se cifra con WebCrypto y la clave vive en almacenamiento del navegador.

Ventajas:

- Reduce exposicion de lectura directa de `localStorage`/IndexedDB.
- Mantiene recuperacion durante una sesion, recarga de pestana y, con clave persistente, despues de cerrar el navegador.
- No requiere servidor adicional ni custodia remota de claves.

Costos:

- No protege contra XSS activo.
- No equivale a cifrado fuerte contra un perfil local comprometido.
- Si se pierde la clave local, la app no debe intentar recuperar datos antiguos.
- Si se copia el perfil completo del navegador, clave y payload pueden viajar juntos.
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

Anamneo es un proyecto personal que quizas jamás alcance un estadío real de producción en una clinica pequeña o grande, si Anamneo saliera mañana sería usado a lo sumo por mi novia Camila que es estudiante de medicina y estaría hosteado en mi servidor en casa usando cloudflared como reverse proxy.

2. Existe una politica real de bloqueo de pantalla, usuarios del sistema operativo separados y cierre de sesion al terminar turno?

No, no existe aún

3. El producto necesita prometer trabajo offline, o basta con tolerar cortes breves durante una misma sesion?

No promete trabajo offline pero no estaría mal dejar registro de que es una funcionalidad que me gustaria implementar en el futuro si la complejidad técnica no es desproporcionada.

4. Cuanto tiempo maximo es aceptable retener drafts locales: minutos, horas, 24 horas o nunca?

opino que 24 horas, pero si consideras que otra opcion es mejor, te insto a usar tu desicion

5. Debe poder recuperarse un draft despues de cerrar completamente el navegador, o solo tras recargar la pestana?

Si, debe poder recuperrse el draft luego de cerrar el navegador.

6. Que rol puede activar persistencia local: usuario individual, admin de clinica, variable de despliegue o nadie?

Admin y variable en .env

7. Como debe comunicarse en UI que hay datos clinicos guardados localmente en este equipo?

deberia comunicarse? los medicos son usuarios no tecnicos, no se por que deberian ver ese tipo de informacion.

8. Al hacer logout, cambio de usuario, firma de atencion o bloqueo temporal del paciente, se deben purgar todos los datos locales relacionados?

solo si esos datos locales ya estan en el servidor.

9. Si falla WebCrypto, preferimos perder la capacidad offline o caer a persistencia plaintext? Recomendacion: fallar cerrado.

Acepto tu recomendacion

10. El soporte tecnico tendra instrucciones para purgar `localStorage`, `sessionStorage` e IndexedDB ante incidente o equipo compartido mal configurado?

no hay equipo tecnico, solo soy yo, el dev

11. Esta decision debe registrarse por clinica como parte de onboarding y consentimiento contractual?

No sé, lo que sea mejor

12. Que evidencia necesitara auditoria: variable de entorno, captura de UI, log de cambio de preferencia, procedimiento operativo o todo lo anterior?

No entiendo la pregunta.

## Recomendacion operativa

Para el despliegue personal actual, usar esta politica:

- `sharedDeviceMode=true` por defecto en ejemplos productivos y equipos compartidos.
- Desactivar modo compartido solo en equipo personal o administrado por el dev/admin.
- Persistencia local: cifrada con WebCrypto, clave persistente en navegador, TTL maximo 24 horas.
- Recuperacion tras cierre de navegador: soportada.
- Purga en logout/cambio de usuario: conservadora hasta tener bitacora de sincronizacion por entidad.
- Sin WebCrypto: no persistir localmente.
- UI: mostrar estado operativo de borrador/pendiente/conflicto; evitar jerga tecnica permanente para usuario clinico.
- Runbook minimo del dev: ante equipo compartido mal configurado, limpiar `localStorage`, `sessionStorage`, IndexedDB y revocar sesiones.

## Riesgo residual

El cifrado local reduce la exposicion accidental en disco, pero no elimina el riesgo de:

- XSS activo durante la sesion.
- Malware local o navegador comprometido.
- Usuario del sistema operativo compartido sin bloqueo.
- Backups del perfil del navegador, especialmente porque la clave local y los payloads cifrados viven en el mismo perfil.
- Captura de pantalla, extensiones o herramientas de soporte remoto.

Por eso la decision final debe combinar controles tecnicos, politica de dispositivo y capacitacion.
