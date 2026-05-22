/**
 * Mini cliente Prometheus en formato texto v0.0.4.
 *
 * Implementado in-house para no agregar una dependencia mas. Soporta counters
 * y gauges con labels limitadas. Si en el futuro se requieren histogramas o
 * summaries, migrar a `prom-client` (es trivial: misma API conceptual).
 */

type LabelSet = Record<string, string | number | boolean | null | undefined>;

interface MetricMeta {
  name: string;
  help: string;
  type: 'counter' | 'gauge';
}

function serializeLabels(labels: LabelSet | undefined): string {
  if (!labels) return '';
  const entries = Object.entries(labels)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}="${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
  if (!entries.length) return '';
  return `{${entries.join(',')}}`;
}

class Counter {
  private values = new Map<string, { labels: LabelSet | undefined; value: number }>();
  constructor(private readonly meta: MetricMeta) {}

  inc(labels?: LabelSet, value = 1) {
    const key = serializeLabels(labels);
    const current = this.values.get(key);
    if (current) {
      current.value += value;
    } else {
      this.values.set(key, { labels, value });
    }
  }

  render(): string {
    const lines: string[] = [];
    lines.push(`# HELP ${this.meta.name} ${this.meta.help}`);
    lines.push(`# TYPE ${this.meta.name} counter`);
    if (this.values.size === 0) {
      lines.push(`${this.meta.name} 0`);
    } else {
      for (const { labels, value } of this.values.values()) {
        lines.push(`${this.meta.name}${serializeLabels(labels)} ${value}`);
      }
    }
    return lines.join('\n');
  }
}

class Gauge {
  private values = new Map<string, { labels: LabelSet | undefined; value: number }>();
  constructor(private readonly meta: MetricMeta) {}

  set(value: number, labels?: LabelSet) {
    const key = serializeLabels(labels);
    this.values.set(key, { labels, value });
  }

  render(): string {
    const lines: string[] = [];
    lines.push(`# HELP ${this.meta.name} ${this.meta.help}`);
    lines.push(`# TYPE ${this.meta.name} gauge`);
    if (this.values.size === 0) {
      lines.push(`${this.meta.name} 0`);
    } else {
      for (const { labels, value } of this.values.values()) {
        lines.push(`${this.meta.name}${serializeLabels(labels)} ${value}`);
      }
    }
    return lines.join('\n');
  }
}

class MetricsRegistry {
  private counters = new Map<string, Counter>();
  private gauges = new Map<string, Gauge>();

  counter(name: string, help: string): Counter {
    let metric = this.counters.get(name);
    if (!metric) {
      metric = new Counter({ name, help, type: 'counter' });
      this.counters.set(name, metric);
    }
    return metric;
  }

  gauge(name: string, help: string): Gauge {
    let metric = this.gauges.get(name);
    if (!metric) {
      metric = new Gauge({ name, help, type: 'gauge' });
      this.gauges.set(name, metric);
    }
    return metric;
  }

  render(): string {
    const parts: string[] = [];
    for (const metric of this.counters.values()) parts.push(metric.render());
    for (const metric of this.gauges.values()) parts.push(metric.render());
    return parts.join('\n\n') + '\n';
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
  }
}

export const metricsRegistry = new MetricsRegistry();

// Metricas pre-declaradas (singletons reutilizados por la app entera)
export const httpRequestsTotal = metricsRegistry.counter(
  'anamneo_http_requests_total',
  'Total de requests HTTP por método, ruta y status',
);
export const httpRequestDurationSecondsSum = metricsRegistry.counter(
  'anamneo_http_request_duration_seconds_sum',
  'Suma de duración de requests (segundos) por ruta',
);
export const authLoginFailedTotal = metricsRegistry.counter(
  'anamneo_auth_login_failed_total',
  'Logins fallidos (anti-enumeration counter)',
);
export const auditChainErrorsTotal = metricsRegistry.counter(
  'anamneo_audit_chain_errors_total',
  'Errores detectados en la cadena de hashes de AuditLog',
);
export const attachmentUploadsTotal = metricsRegistry.counter(
  'anamneo_attachment_uploads_total',
  'Adjuntos subidos por mime declarado',
);
export const sqliteBackupAgeHours = metricsRegistry.gauge(
  'anamneo_sqlite_backup_age_hours',
  'Edad en horas del último backup SQLite exitoso',
);
