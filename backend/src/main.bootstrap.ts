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

  const corsOriginEnv = configService.get<string>('CORS_ORIGIN', 'http://localhost:5556');
  const corsOrigins = corsOriginEnv.split(',').map((origin) => origin.trim());

  console.log(JSON.stringify({
    level: 'info',
    event: 'config_loaded',
    corsOrigins,
    trustProxy,
  }));

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

  const port = configService.get<number>('PORT', 5679);
  await app.listen(port, '0.0.0.0');

  console.log(JSON.stringify({
    level: 'info',
    event: 'server_started',
    port,
    url: `http://localhost:${port}`,
  }));
}
