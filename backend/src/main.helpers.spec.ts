import { ConfigService } from '@nestjs/config';
import { assertSafeConfig } from './main.helpers';

type ConfigValues = Record<string, string | undefined>;

function buildConfig(values: ConfigValues) {
  return {
    get<T = string>(key: string, defaultValue?: T) {
      return (values[key] ?? defaultValue) as T;
    },
  } as ConfigService;
}

function buildProductionConfig(overrides: ConfigValues = {}) {
  return buildConfig({
    NODE_ENV: 'production',
    DATABASE_URL: 'file:/app/data/anamneo.db',
    ALLOW_SQLITE_IN_PRODUCTION: 'true',
    ANAMNEO_DEPLOYMENT_SCOPE: 'single-clinic',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    BOOTSTRAP_TOKEN: 'c'.repeat(32),
    SETTINGS_ENCRYPTION_KEY: 'd'.repeat(32),
    ENCRYPTION_AT_REST_CONFIRMED: 'true',
    ENCRYPTION_KEY: 'e'.repeat(64),
    TRUST_PROXY: '1',
    APP_TIME_ZONE: 'America/Santiago',
    ...overrides,
  });
}

describe('assertSafeConfig deployment scope', () => {
  it('accepts the supported single-clinic production scope', () => {
    expect(() => assertSafeConfig(buildProductionConfig())).not.toThrow();
  });

  it('requires an explicit deployment scope in production', () => {
    expect(() => assertSafeConfig(buildProductionConfig({ ANAMNEO_DEPLOYMENT_SCOPE: undefined }))).toThrow(
      'ANAMNEO_DEPLOYMENT_SCOPE=single-clinic is required in production',
    );
  });

  it('rejects multi-tenant production deployments until a tenant model exists', () => {
    expect(() => assertSafeConfig(buildProductionConfig({ ANAMNEO_DEPLOYMENT_SCOPE: 'multi-tenant' }))).toThrow(
      'Only ANAMNEO_DEPLOYMENT_SCOPE=single-clinic is supported in this release',
    );
  });
});

describe('assertSafeConfig field encryption', () => {
  it('requires ENCRYPTION_KEY in production', () => {
    expect(() => assertSafeConfig(buildProductionConfig({ ENCRYPTION_KEY: undefined }))).toThrow(
      'ENCRYPTION_KEY is required in production',
    );
  });

  it('rejects short or non-hex ENCRYPTION_KEY in production', () => {
    expect(() => assertSafeConfig(buildProductionConfig({ ENCRYPTION_KEY: 'short' }))).toThrow(
      'ENCRYPTION_KEY must be a 64-character hex string',
    );
    expect(() => assertSafeConfig(buildProductionConfig({ ENCRYPTION_KEY: 'z'.repeat(64) }))).toThrow(
      'ENCRYPTION_KEY must be a 64-character hex string',
    );
  });

  it('allows omitting ENCRYPTION_KEY outside production (for backwards compatibility)', () => {
    expect(() => assertSafeConfig(buildConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'file:./dev.db',
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
    }))).not.toThrow();
  });
});

describe('assertSafeConfig trust proxy', () => {
  it('requires TRUST_PROXY in production', () => {
    expect(() => assertSafeConfig(buildProductionConfig({ TRUST_PROXY: undefined }))).toThrow(
      'TRUST_PROXY must be configured in production',
    );
    expect(() => assertSafeConfig(buildProductionConfig({ TRUST_PROXY: 'false' }))).toThrow(
      'TRUST_PROXY must be configured in production',
    );
  });
});
