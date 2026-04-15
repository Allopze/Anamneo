// IMPORTANT: instrument.ts must be imported before everything else
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestTracingMiddleware } from './common/utils/request-tracing';
import { resolveSettingsEncryptionSecrets } from './settings/settings-encryption';

function assertSafeConfig(configService: ConfigService) {
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

function resolveTrustProxySetting(rawValue: string | undefined) {
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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  let isShuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    console.log(JSON.stringify({
      level: 'info',
      event: 'shutdown_signal_received',
      signal,
    }));

    try {
      await app.close();
      console.log(JSON.stringify({
        level: 'info',
        event: 'server_stopped',
        signal,
      }));
      process.exit(0);
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'shutdown_failed',
        signal,
        message: error instanceof Error ? error.message : 'unknown_error',
      }));
      process.exit(1);
    }
  };

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }

  const configService = app.get(ConfigService);
  assertSafeConfig(configService);
  const trustProxy = resolveTrustProxySetting(configService.get<string>('TRUST_PROXY'));
  const httpAdapter = app.getHttpAdapter();

  // Security middleware
  httpAdapter.getInstance().set('trust proxy', trustProxy);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use(cookieParser());
  app.use(requestTracingMiddleware);

  const corsOriginEnv = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:5555',
  );
  const corsOrigins = corsOriginEnv.split(',').map((origin) => origin.trim());
  console.log(JSON.stringify({
    level: 'info',
    event: 'config_loaded',
    corsOrigins,
    trustProxy,
  }));

  // CORS
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Global exception filter — sanitizes errors in production
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  const port = configService.get<number>('PORT', 5678);
  await app.listen(port, '0.0.0.0');

  console.log(JSON.stringify({
    level: 'info',
    event: 'server_started',
    port,
    url: `http://localhost:${port}`,
  }));
}

bootstrap().catch((error) => {
  console.error(JSON.stringify({
    level: 'error',
    event: 'bootstrap_failed',
    message: error instanceof Error ? error.message : 'unknown_error',
  }));
  process.exit(1);
});
