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
    DATABASE_URL: 'postgresql://anamneo_app:app@localhost:5432/anamneo?schema=public',
    MIGRATION_DATABASE_URL: 'postgresql://anamneo_owner:owner@localhost:5432/anamneo?schema=public',
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
      'ENCRYPTION_KEY is required',
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

  it('requires ENCRYPTION_KEY outside production too', () => {
    expect(() => assertSafeConfig(buildConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://anamneo_app:app@localhost:5432/anamneo?schema=public',
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
    }))).toThrow('ENCRYPTION_KEY is required');
  });
});

describe('assertSafeConfig database provider', () => {
  it('requires PostgreSQL in production', () => {
    expect(() => assertSafeConfig(buildProductionConfig({ DATABASE_URL: 'file:/app/data/anamneo.db' }))).toThrow(
      'DATABASE_URL must use postgresql:// or postgres://',
    );
  });

  it('rejects placeholder migration URLs in production', () => {
    expect(() => assertSafeConfig(buildProductionConfig({ MIGRATION_DATABASE_URL: 'postgresql://CHANGE_ME@localhost/anamneo' }))).toThrow(
      'MIGRATION_DATABASE_URL must not contain placeholder values',
    );
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
