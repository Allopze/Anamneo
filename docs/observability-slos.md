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

## 2. Stack operativo en Docker Compose

`docker-compose.yml` levanta un stack local y persistente:

| Servicio | Puerto local | Persistencia | Uso |
|---|---:|---|---|
| `prometheus` | `127.0.0.1:9090` | volumen `prometheus-data` | Scrape de `/api/metrics` y reglas de alerta |
| `grafana` | `127.0.0.1:3000` | volumen `grafana-data` | Dashboard provisionado `Anamneo Operations` |
| `loki` | `127.0.0.1:3100` | volumen `loki-data` | Retencion de logs enviados por Promtail |
| `log-shipper` | interno | volumen `promtail-positions` | Promtail lee logs Docker y scrubbea PHI basica |

Variables recomendadas antes de considerar operativo el stack:

- `METRICS_SCRAPE_TOKEN`: token Bearer usado por Prometheus contra
  `/api/metrics`.
- `GRAFANA_ADMIN_PASSWORD`: password inicial del admin local de Grafana.

Los puertos quedan bindados a `127.0.0.1` por defecto. Si se exponen fuera del
host, ponerlos detras de VPN/reverse proxy con autenticacion.

---

## 3. Endpoint Prometheus

- Path: `GET /api/metrics`
- Auth: sesión admin humana o `Authorization: Bearer $METRICS_SCRAPE_TOKEN`
  para scrape automatizado.
- Formato: `text/plain; version=0.0.4; charset=utf-8` (Prometheus exposition).
- **No exponer públicamente por cloudflared.** El sidecar Prometheus debe
  correr en la misma red local del host y autenticarse con basic-auth en la
  capa de proxy si fuese requerido.

### Metricas expuestas

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

## 4. Busqueda en logs

Todos los logs HTTP del backend incluyen `requestId` propagado por
`backend/src/common/utils/request-tracing.ts:75-81`. Los UUIDs en path son
enmascarados como `:id` para evitar cardinalidad y exposición.

### Buscar por requestId

```bash
docker compose logs --since 24h backend | grep '"requestId":"<uuid>"'
```

En Loki, filtrar por `requestId`:

```logql
{container="anamneo-backend"} |= "<uuid>"
```

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

## 5. Alertas activas

Las reglas estan en `infra/prometheus-alerts.yml` y se cargan en Prometheus al
arrancar `docker compose up -d prometheus`.

| Alerta | Condicion | Severidad |
|---|---|---|
| `AnamneoBackendScrapeDown` | `up{job="anamneo-backend"} == 0` por > 2 min | critica |
| 5xx burst | `rate(anamneo_http_requests_total{status=~"5.."}[5m]) > 0.1` | alta |
| Backup viejo | `anamneo_sqlite_backup_age_hours > 12` | alta |
| Login brute force | `rate(anamneo_auth_login_failed_total[1m]) > 10` | media |
| Audit chain rota | `anamneo_audit_chain_errors_total > 0` | critica |

---

## 6. Operacion del dashboard

1. Levantar stack: `docker compose up -d prometheus loki log-shipper grafana`.
2. Abrir Grafana en `http://127.0.0.1:3000`.
3. Entrar con `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`.
4. Revisar dashboard `Anamneo / Anamneo Operations`.
5. Revisar alertas en Prometheus: `http://127.0.0.1:9090/alerts`.

## 7. Pendientes conocidos

- Si se requiere notificacion externa para todas las alertas Prometheus, agregar
  Alertmanager o Grafana contact points hacia Slack/Discord/email.
- Cuando se migre a PostgreSQL (F-07), agregar metricas de pool, latencia de
  query y replication lag.
