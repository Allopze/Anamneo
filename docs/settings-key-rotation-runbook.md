# Runbook de Rotación de Claves de Ajustes

## Alcance

Este runbook cubre la rotación de `SETTINGS_ENCRYPTION_KEY` y `SETTINGS_ENCRYPTION_KEYS` usadas para cifrar secretos persistidos en `Setting`, actualmente `smtp.password`.

Mientras Anamneo no use un secret manager externo, estas claves deben vivir solo en variables de entorno seguras del despliegue y nunca en el repositorio ni en la base de datos.

## Precondiciones

1. Tener acceso al entorno donde corre backend.
2. Confirmar backup reciente de la base SQLite.
3. Preparar una nueva clave de alta entropía.
4. Conservar temporalmente la clave anterior para permitir relectura y rewrap.

## Procedimiento de rotación

1. Generar una nueva clave y guardarla en el sistema de secretos del entorno.
2. Configurar el backend con la nueva clave en primer lugar:

```env
SETTINGS_ENCRYPTION_KEY=new-active-key
SETTINGS_ENCRYPTION_KEYS=new-active-key,old-previous-key
```

3. Reiniciar el backend.
4. Forzar una lectura administrativa de settings para disparar el rewrap automático.
   Un `GET /api/settings` autenticado como admin es suficiente.
5. Verificar que la app sigue reportando `smtp.passwordConfigured` y que nunca devuelve `smtp.password` al cliente.
6. Verificar que el secreto persistido sigue con prefijo `enc:v1:`.
7. Cuando el rewrap ya se haya ejecutado en todos los secretos activos, retirar la clave antigua:

```env
SETTINGS_ENCRYPTION_KEY=new-active-key
SETTINGS_ENCRYPTION_KEYS=new-active-key
```

8. Reiniciar backend y repetir la verificación funcional.

## Rollback

Si el backend no puede descifrar settings cifrados tras la rotación:

1. Restaurar temporalmente la clave antigua en `SETTINGS_ENCRYPTION_KEYS`.
2. Reiniciar backend.
3. Validar acceso a `GET /api/settings`.
4. Repetir la rotación con una ventana controlada.

## Checklist de verificación

- `GET /api/settings` como admin responde `200`.
- La respuesta incluye `smtp.passwordConfigured`.
- La respuesta no incluye `smtp.password`.
- El envío de invitación de prueba sigue funcionando o falla con diagnóstico de SMTP, pero no por descifrado.
- No hay errores de descifrado en logs del backend.

## Deuda que sigue abierta

- Externalizar estos secretos a un secret manager real.
- Automatizar una verificación operativa de rewrap completo antes de retirar claves antiguas.
