import { metricsRegistry } from './metrics-registry';

describe('metricsRegistry', () => {
  beforeEach(() => {
    metricsRegistry.reset();
  });

  it('increments counters with labels and renders Prometheus text', () => {
    const counter = metricsRegistry.counter('test_counter', 'test counter');
    counter.inc({ a: 'x' });
    counter.inc({ a: 'x' });
    counter.inc({ a: 'y' }, 5);

    const text = metricsRegistry.render();
    expect(text).toContain('# HELP test_counter test counter');
    expect(text).toContain('# TYPE test_counter counter');
    expect(text).toContain('test_counter{a="x"} 2');
    expect(text).toContain('test_counter{a="y"} 5');
  });

  it('sets gauges and overrides previous values', () => {
    const gauge = metricsRegistry.gauge('test_gauge', 'test gauge');
    gauge.set(10);
    gauge.set(7);

    const text = metricsRegistry.render();
    expect(text).toContain('# TYPE test_gauge gauge');
    expect(text).toMatch(/test_gauge 7$/m);
    expect(text).not.toMatch(/test_gauge 10$/m);
  });

  it('renders zero value for unused counter so scrape format remains valid', () => {
    metricsRegistry.counter('zeroed', 'zero counter');
    const text = metricsRegistry.render();
    expect(text).toContain('zeroed 0');
  });

  it('escapes label values', () => {
    const counter = metricsRegistry.counter('escape_counter', 'escape test');
    counter.inc({ msg: 'value with "quotes" and \\ backslash' });
    const text = metricsRegistry.render();
    expect(text).toContain('escape_counter{msg="value with \\"quotes\\" and \\\\ backslash"} 1');
  });
});
