# Observabilidad y SLOs — Anamneo

Este documento define los SLOs mínimos de operación, las métricas Prometheus
disponibles y los runbooks de búsqueda en logs.

---

## 1. SLOs (single-clinic interno)

| SLI | Objetivo | Cálculo | Ventana |
|---|---|---|---|
| Disponibilidad backend | ≥ 99.5% | `1 - (5xx / total)` sobre `anamneo_http_requests_total` | 30 días |
| Latencia p95 `/api/encounters/*` | < 800ms | percentil 95 de `anamneo_http_request_duration_seconds_sum` por route | 30 días |
| Tasa de error 5xx global | < 0.5% | `5xx_total / total` por route | 30 días |
| Edad del último backup | < 6h | `anamneo_sqlite_backup_age_hours` gauge | continuo |
| Restore drill | éxito semanal | éxito reciente de `db:ops:restore-drill` | 7 días |
| Login fallidos por minuto | alerta > 20 | `rate(anamneo_auth_login_failed_total[1m])` | 1 min |
| Errores de cadena de auditoría | 0 | `anamneo_audit_chain_errors_total` debe quedar en 0 | continuo |

**Error budget:** 0.5% mensual ≈ 3.6h de downtime/mes. Si se quema antes del
día 25, congelar releases no-críticos hasta corte de mes.

---

## 2. Endpoint Prometheus

- Path: `GET /api/metrics`
- Auth: requiere sesión admin (cookie HttpOnly + 2FA si activo).
- Formato: `text/plain; version=0.0.4; charset=utf-8` (Prometheus exposition).
- **No exponer públicamente por cloudflared.** El sidecar Prometheus debe
  correr en la misma red local del host y autenticarse con basic-auth en la
  capa de proxy si fuese requerido.

### Métricas expuestas

| Métrica | Tipo | Labels | Significado |
|---|---|---|---|
| `anamneo_http_requests_total` | counter | `method`, `route`, `status` | Total de requests servidos |
| `anamneo_http_request_duration_seconds_sum` | counter | `route` | Suma de duración por ruta (usar con `_count` derivado vía relabel si requiere) |
| `anamneo_auth_login_failed_total` | counter | `locked` | Logins rechazados (`locked=true` cuando se bloqueó la cuenta) |
| `anamneo_audit_chain_errors_total` | counter | — | Errores detectados verificando la cadena de hashes del AuditLog |
| `anamneo_attachment_uploads_total` | counter | `mime` | Adjuntos creados por tipo MIME declarado |
| `anamneo_sqlite_backup_age_hours` | gauge | — | Edad del último backup. Se actualiza en cada scrape consultando `getSqliteOperationalStatus` |

### Cómo añadir nuevas métricas

1. Editar `backend/src/metrics/metrics-registry.ts` y declarar el contador o gauge.
2. Importarlo en el servicio que la incremente.
3. Documentarla aquí.
4. Si requiere histograma/summary real, migrar a `prom-client` (`npm install
   prom-client --workspace backend`) y reemplazar el registry in-house.

---

## 3. Búsqueda en logs

Todos los logs HTTP del backend incluyen `requestId` propagado por
`backend/src/common/utils/request-tracing.ts:75-81`. Los UUIDs en path son
enmascarados como `:id` para evitar cardinalidad y exposición.

### Buscar por requestId

```bash
docker compose logs --since 24h backend | grep '"requestId":"<uuid>"'
```

En el shipper persistente (Loki/Datadog/etc.), filtrar por la label/atributo
`requestId`.

### Buscar por usuario

```bash
docker compose logs --since 24h backend \
  | jq -r 'select(.event=="http_request") | "\(.requestId) \(.method) \(.path) \(.statusCode) \(.durationMs)"'
```

### PHI en logs

Los logs nunca deben incluir RUT, email completo o secuencias largas de
dígitos en mensajes de error. Si llegan a Sentry son scrubeados por
`backend/src/instrument.ts:beforeSend`. Si llegan al log shipper, el
filtro PHI debe configurarse en el agente con las mismas reglas
declaradas en `backend/src/common/utils/phi-scrub.ts`.

---

## 4. Alertas recomendadas (operador define)

| Alerta | Condición | Severidad |
|---|---|---|
| Backend down | `up{job="anamneo-backend"} == 0` por > 2 min | crítica |
| 5xx burst | `rate(anamneo_http_requests_total{status=~"5.."}[5m]) > 0.1` | alta |
| Backup viejo | `anamneo_sqlite_backup_age_hours > 12` | alta |
| Login brute force | `rate(anamneo_auth_login_failed_total[1m]) > 10` | media |
| Audit chain rota | `anamneo_audit_chain_errors_total > 0` | crítica |
| Disco | `node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.2` | alta |

---

## 5. Próximos pasos

- Decidir log shipper (Loki / Vector → S3 / Datadog) — ver `docs/incident-runbooks.md`.
- Configurar Grafana dashboards con las métricas de §2.
- Definir alerting a Slack/Discord usando `SQLITE_ALERT_WEBHOOK_URL` como template.
- Cuando se migre a PostgreSQL (F-07), agregar métricas de pool, latencia de
  query y replication lag.
