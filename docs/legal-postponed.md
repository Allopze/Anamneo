# Pendientes Legales Postergados

Esta nota deja fuera del alcance de implementacion tecnica actual las decisiones y textos legales sustantivos. Deben cerrarse con asesor legal externo y responsable del tratamiento antes de operar con datos reales o activar controles regulatorios estrictos.

## Postergado

- Politica de privacidad v1.0 final, publicada y aprobada.
- RAT / catalogo formal de actividades de tratamiento.
- DPIA final y anexos de riesgo.
- Designacion definitiva de DPO y evidencias de independencia/recursos.
- DPAs y clausulas con encargados/subencargados.
- Matriz legal final de finalidades y bases de licitud.
- Canal formal ante la Agencia de Proteccion de Datos Personales.
- Sanciones internas/RRHH y regimen disciplinario asociado.
- Certificacion o reconocimiento externo del modelo de cumplimiento.

## Bloqueo Operativo

`REGULATORY_CONSENT_ENFORCEMENT=hard` queda bloqueado hasta que:

1. La politica de privacidad v1.0 este publicada y validada.
2. El consentimiento historico necesario este backfilled o se haya definido un plan de recaptura.
3. Legal confirme que el texto, la evidencia y el flujo cumplen el criterio aplicable.

## Checklist verificable antes de hard enforcement

- Politica de privacidad v1.0 publicada, con version exacta registrada en `LegalDocument`.
- Backfill o recaptura de consentimientos de pacientes preexistentes completado, con muestreo documentado.
- RAT, DPIA, designacion DPO y DPAs de Cloudflare/Sentry/SMTP firmados o aprobados formalmente.
- Drill de brecha ejecutado con tiempos, decisiones de notificacion y post-mortem registrados.
- Responsable operativo confirma por escrito el cambio de `REGULATORY_CONSENT_ENFORCEMENT=soft` a `hard`.

No modificar textos legales sustantivos ni semillas legales para cerrar estos puntos sin revision legal externa.
