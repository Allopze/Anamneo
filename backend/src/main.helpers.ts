import { ConfigService } from '@nestjs/config';
import { resolveSettingsEncryptionSecrets } from './settings/settings-encryption';

export function assertSafeConfig(configService: ConfigService) {
  const databaseUrl = configService.get<string>('DATABASE_URL');
  const jwtSecret = configService.get<string>('JWT_SECRET');
  const jwtRefreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
  const appTimeZone = configService.get<string>('APP_TIME_ZONE', 'America/Santiago');
  const bootstrapToken = configService.get<string>('BOOTSTRAP_TOKEN')?.trim();
  const settingsEncryptionKeys = resolveSettingsEncryptionSecrets(
    configService.get<string>('SETTINGS_ENCRYPTION_KEY'),
    configService.get<string>('SETTINGS_ENCRYPTION_KEYS'),
  );
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';
  const allowSqliteInProduction = configService.get<string>('ALLOW_SQLITE_IN_PRODUCTION', 'false') === 'true';
  const placeholderValues = new Set([
    'replace-with-a-secure-random-secret',
    'replace-with-a-different-secure-random-secret',
    'replace-with-a-secure-bootstrap-token',
    'replace-with-a-secure-settings-key',
    'change_this_in_production',
    'change_this_refresh_secret_too',
  ]);

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  if (databaseUrl.includes('change-me') || databaseUrl.includes('replace-with')) {
    throw new Error('DATABASE_URL must not contain placeholder values');
  }

  const isSqlite = databaseUrl.startsWith('file:');
  if (isProduction && isSqlite && !allowSqliteInProduction) {
    throw new Error('SQLite in production requires ALLOW_SQLITE_IN_PRODUCTION=true. Prefer PostgreSQL for production.');
  }

  if (!jwtSecret || placeholderValues.has(jwtSecret)) {
    throw new Error('JWT_SECRET must be configured with a non-placeholder value');
  }

  if (!jwtRefreshSecret || placeholderValues.has(jwtRefreshSecret)) {
    throw new Error('JWT_REFRESH_SECRET must be configured with a non-placeholder value');
  }

  if (jwtSecret === jwtRefreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different values');
  }

  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone: appTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    throw new Error(`APP_TIME_ZONE is invalid: ${appTimeZone}`);
  }

  if (isProduction && (jwtSecret.length < 32 || jwtRefreshSecret.length < 32)) {
    throw new Error('JWT secrets must be at least 32 characters in production');
  }

  if (isProduction) {
    if (!bootstrapToken) {
      throw new Error('BOOTSTRAP_TOKEN must be configured in production');
    }

    if (placeholderValues.has(bootstrapToken) || bootstrapToken.length < 32) {
      throw new Error('BOOTSTRAP_TOKEN must be non-placeholder and at least 32 characters in production');
    }
  }

  if (isProduction) {
    if (settingsEncryptionKeys.length === 0) {
      throw new Error('SETTINGS_ENCRYPTION_KEY or SETTINGS_ENCRYPTION_KEYS must be configured in production');
    }

    const invalidKey = settingsEncryptionKeys.find((secret) => placeholderValues.has(secret) || secret.length < 32);
    if (invalidKey) {
      throw new Error(
        'Every SETTINGS_ENCRYPTION_KEY/SETTINGS_ENCRYPTION_KEYS entry must be non-placeholder and at least 32 characters in production',
      );
    }
  }

  if (isProduction) {
    const encryptionAtRestConfirmed = configService.get<string>('ENCRYPTION_AT_REST_CONFIRMED', 'false') === 'true';
    if (!encryptionAtRestConfirmed) {
      console.warn(JSON.stringify({
        level: 'warn',
        event: 'encryption_at_rest_not_confirmed',
        message: 'ENCRYPTION_AT_REST_CONFIRMED is not set. Clinical attachments and database backups are stored unencrypted on disk. If the host filesystem is not encrypted (e.g. LUKS/dm-crypt), a host compromise exposes clinical data. Set ENCRYPTION_AT_REST_CONFIRMED=true after enabling filesystem-level encryption.',
      }));
    }
  }
}

export function resolveTrustProxySetting(rawValue: string | undefined) {
  const trimmed = rawValue?.trim();

  if (!trimmed || trimmed.toLowerCase() === 'false') {
    return false;
  }

  if (trimmed.toLowerCase() === 'true') {
    return true;
  }

  const numericValue = Number.parseInt(trimmed, 10);
  if (Number.isFinite(numericValue) && String(numericValue) === trimmed) {
    return numericValue;
  }

  return trimmed;
}

export function readDevWatchProcessIds() {
  const expectedParentPid = Number.parseInt(process.env.ANAMNEO_DEV_EXPECTED_PARENT_PID ?? '', 10);
  const sessionLeaderPid = Number.parseInt(process.env.ANAMNEO_DEV_SESSION_LEADER_PID ?? '', 10);

  return {
    expectedParentPid: Number.isFinite(expectedParentPid) ? expectedParentPid : null,
    sessionLeaderPid: Number.isFinite(sessionLeaderPid) ? sessionLeaderPid : null,
  };
}
