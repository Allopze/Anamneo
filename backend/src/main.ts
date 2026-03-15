import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';

function assertSafeConfig(configService: ConfigService) {
  const databaseUrl = configService.get<string>('DATABASE_URL');
  const jwtSecret = configService.get<string>('JWT_SECRET');
  const jwtRefreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';
  const allowSqliteInProduction = configService.get<string>('ALLOW_SQLITE_IN_PRODUCTION', 'false') === 'true';
  const placeholderValues = new Set([
    'replace-with-a-secure-random-secret',
    'replace-with-a-different-secure-random-secret',
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

  // Security middleware
  app.use(helmet());
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();
    const headerRequestId = req.headers['x-request-id'];
    const requestId = typeof headerRequestId === 'string' && headerRequestId.trim().length > 0
      ? headerRequestId.trim()
      : randomUUID();

    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const logEntry = {
        level: res.statusCode >= 500 ? 'error' : 'info',
        event: 'http_request',
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      };

      const serialized = JSON.stringify(logEntry);
      if (res.statusCode >= 500) {
        console.error(serialized);
        return;
      }
      console.log(serialized);
    });

    next();
  });

  const corsOriginEnv = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:5555',
  );
  const corsOrigins = corsOriginEnv.split(',').map((origin) => origin.trim());
  console.log(JSON.stringify({
    level: 'info',
    event: 'config_loaded',
    corsOrigins,
  }));

  // CORS
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

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

  const port = configService.get<number>('PORT', 4444);
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
