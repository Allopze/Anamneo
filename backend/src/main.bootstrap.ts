import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestTracingMiddleware } from './common/utils/request-tracing';
import {
  assertSafeConfig,
  readDevWatchProcessIds,
  resolveTrustProxySetting,
} from './main.helpers';
import { isEncryptionEnabled } from './common/utils/field-crypto';
import { PrismaService } from './prisma/prisma.service';
import { csrfMiddleware } from './common/middleware/csrf.middleware';
import { metricsMiddleware } from './metrics/metrics.middleware';

async function setupDevWatchHealth() {
  const devWatchProcessIds = readDevWatchProcessIds();

  if (!devWatchProcessIds.expectedParentPid && !devWatchProcessIds.sessionLeaderPid) {
    return;
  }

  const interval = setInterval(() => {
    if (
      devWatchProcessIds.expectedParentPid
      && devWatchProcessIds.expectedParentPid > 1
      && process.ppid !== devWatchProcessIds.expectedParentPid
    ) {
      console.log(JSON.stringify({
        level: 'info',
        event: 'dev_parent_gone',
        expectedParentPid: devWatchProcessIds.expectedParentPid,
        currentParentPid: process.ppid,
      }));
      process.kill(process.pid, 'SIGTERM');
      return;
    }

    if (
      process.platform === 'linux'
      && devWatchProcessIds.sessionLeaderPid
      && devWatchProcessIds.sessionLeaderPid > 1
      && !existsSync(`/proc/${devWatchProcessIds.sessionLeaderPid}`)
    ) {
      console.log(JSON.stringify({
        level: 'info',
        event: 'dev_session_gone',
        sessionLeaderPid: devWatchProcessIds.sessionLeaderPid,
      }));
      process.kill(process.pid, 'SIGTERM');
    }
  }, 1000);

  interval.unref();
}

function buildShutdownHandler(app: Awaited<ReturnType<typeof NestFactory.create>>) {
  let isShuttingDown = false;

  return async (signal: NodeJS.Signals) => {
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
}

export async function bootstrapApp() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const shutdown = buildShutdownHandler(app);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }

  await setupDevWatchHealth();

  const configService = app.get(ConfigService);
  assertSafeConfig(configService);
  const trustProxy = resolveTrustProxySetting(configService.get<string>('TRUST_PROXY'));
  const httpAdapter = app.getHttpAdapter();

  httpAdapter.getInstance().set('trust proxy', trustProxy);
  app.use(helmet({
    // El backend solo sirve /api (JSON). CSP estricta sin 'unsafe-inline' es seguro
    // porque no se evalua HTML. El frontend Next provee su propia CSP con nonce.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
        baseUri: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use(cookieParser());
  app.use(requestTracingMiddleware);
  app.use(metricsMiddleware);
  // CSRF en mutaciones (excepto login/register/refresh/2fa-verify/forgot-password).
  // Se ejecuta despues de cookieParser porque depende de req.cookies.
  // En test mode se desactiva para mantener simples las e2e suites existentes;
  // hay tests dedicados que verifican el comportamiento del middleware.
  if (process.env.NODE_ENV !== 'test') {
    app.use(csrfMiddleware);
  }

  const corsOriginEnv = configService.get<string>('CORS_ORIGIN', 'http://localhost:5555');
  const corsOrigins = corsOriginEnv.split(',').map((origin) => origin.trim());

  const phiFieldEncryption = isEncryptionEnabled();
  console.log(JSON.stringify({
    level: 'info',
    event: 'config_loaded',
    corsOrigins,
    trustProxy,
    phiFieldEncryption,
  }));

  if (!phiFieldEncryption) {
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'phi_field_encryption_disabled',
      message: 'ENCRYPTION_KEY is not set or invalid; clinical sections will be persisted in cleartext. '
        + 'In NODE_ENV=production the app refuses to boot without it.',
    }));
  }

  // F-10: si hay admin activo y todavia hay BOOTSTRAP_TOKEN configurado, avisar.
  // El token solo es usable cuando no hay admin, pero rotarlo despues del primer
  // uso es buena higiene operativa.
  try {
    const prisma = app.get(PrismaService);
    const adminCount = await prisma.user.count({ where: { isAdmin: true, active: true } });
    const bootstrapToken = configService.get<string>('BOOTSTRAP_TOKEN')?.trim();
    if (adminCount > 0 && bootstrapToken) {
      console.warn(JSON.stringify({
        level: 'warn',
        event: 'bootstrap_token_still_configured',
        message: 'BOOTSTRAP_TOKEN remains configured but an active admin already exists. '
          + 'Rotate or remove the token to reduce blast radius if it leaks.',
      }));
    }
  } catch {
    // No bloqueamos el arranque por este check.
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());
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

  app.setGlobalPrefix('api');

  const port = configService.get<number>('BACKEND_PORT') ?? configService.get<number>('PORT', 5678);
  const host = configService.get<string>('BACKEND_BIND_HOST', '0.0.0.0');
  await app.listen(port, host);

  console.log(JSON.stringify({
    level: 'info',
    event: 'server_started',
    port,
    url: `http://localhost:${port}`,
  }));
}
