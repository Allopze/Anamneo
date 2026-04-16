/**
 * Shared E2E test setup — app bootstrap, teardown, state, and request helpers.
 *
 * Every suite file imports from here so that the single NestJS app instance
 * and mutable state (IDs, cookie jars) are shared across ordered describe blocks.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthModule } from '../../src/auth/auth.module';
import { UsersModule } from '../../src/users/users.module';
import { PatientsModule } from '../../src/patients/patients.module';
import { EncountersModule } from '../../src/encounters/encounters.module';
import { ConditionsModule } from '../../src/conditions/conditions.module';
import { AttachmentsModule } from '../../src/attachments/attachments.module';
import { ConsentsModule } from '../../src/consents/consents.module';
import { AlertsService } from '../../src/alerts/alerts.service';
import { AuditModule } from '../../src/audit/audit.module';
import { SettingsModule } from '../../src/settings/settings.module';
import { HealthController } from '../../src/health.controller';
import { requestTracingMiddleware } from '../../src/common/utils/request-tracing';

// ── Test database URL resolution ────────────────────────────────────

const TEST_DB_FILENAME = `test-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`;
const DEFAULT_TEST_DATABASE_URL = `file:./${TEST_DB_FILENAME}`;

function resolveBaseTestDatabaseUrl() {
  const explicitTestUrl = process.env.TEST_DATABASE_URL;
  if (explicitTestUrl?.startsWith('file:')) {
    return explicitTestUrl;
  }
  return DEFAULT_TEST_DATABASE_URL;
}

function resolveSqliteFilePath(databaseUrl: string): string | null {
  if (!databaseUrl.startsWith('file:')) {
    return null;
  }
  const rawPath = databaseUrl.slice('file:'.length);
  if (rawPath.startsWith('/')) {
    return rawPath;
  }
  const prismaDirectory = path.join(__dirname, '..', '..', 'prisma');
  const normalizedRelativePath = rawPath.replace(/^\.\//, '');
  return path.resolve(prismaDirectory, normalizedRelativePath);
}

// ── Shared mutable state ────────────────────────────────────────────

export const state = {
  medicoUserId: '',
  assistantUserId: '',
  patientId: '',
  quickPatientId: '',
  blockedPatientId: '',
  encounterId: '',
  blockedEncounterId: '',
  workflowEncounterId: '',
  patientProblemId: '',
  patientTaskId: '',
  attachmentId: '',
  localConditionId: '',
  secondLocalConditionId: '',

  adminCookies: [] as string[],
  medicoCookies: [] as string[],
  assistantCookies: [] as string[],
  medicoInvitationToken: '',
  medicoTotpSecret: '',
  medicoTempToken: '',
  revokedInvitationId: '',
  revokedInvitationToken: '',
};

// ── App references ──────────────────────────────────────────────────

let app: INestApplication;
let httpServer: any;
let testDatabaseFilePath: string | null = null;
let testSchemaSqlPath: string | null = null;
let testUploadsDirectory: string | null = null;

export let prisma: PrismaService;
export let alertsService: AlertsService;

// ── Helpers ─────────────────────────────────────────────────────────

export function extractCookies(res: request.Response): string[] {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return [];
  return Array.isArray(setCookie) ? setCookie : [setCookie];
}

export function cookieHeader(cookies: string[]): string {
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

export function req() {
  return request(httpServer);
}

// ── Bootstrap / Teardown ────────────────────────────────────────────

export async function bootstrapApp() {
  const testDatabaseUrl = resolveBaseTestDatabaseUrl();
  testDatabaseFilePath = resolveSqliteFilePath(testDatabaseUrl);
  testSchemaSqlPath = path.join(__dirname, '..', `schema-e2e-${Date.now()}.sql`);
  testUploadsDirectory = path.join(__dirname, '..', `uploads-e2e-${Date.now()}`);

  if (testDatabaseFilePath && fs.existsSync(testDatabaseFilePath)) {
    fs.rmSync(testDatabaseFilePath, { force: true });
  }

  if (testUploadsDirectory) {
    fs.mkdirSync(testUploadsDirectory, { recursive: true });
  }

  // Set env vars for test
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
  process.env.JWT_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.SETTINGS_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
  process.env.NODE_ENV = 'test';
  process.env.UPLOAD_DEST = testUploadsDirectory;
  process.env.APP_PUBLIC_URL = 'http://localhost:5555';
  process.env.SMTP_HOST = '';
  process.env.SMTP_PORT = '';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASSWORD = '';
  process.env.SMTP_FROM_EMAIL = '';
  process.env.SMTP_FROM_NAME = '';

  execSync('npx prisma generate', {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'pipe',
  });

  const schemaSql = execSync(
    'npx prisma migrate diff --from-empty --to-schema-datamodel ./prisma/schema.prisma --script',
    {
      cwd: path.join(__dirname, '..', '..'),
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'pipe',
    },
  ).toString();

  fs.writeFileSync(testSchemaSqlPath!, schemaSql, 'utf8');

  execSync(`npx prisma db execute --file "${testSchemaSqlPath}" --schema ./prisma/schema.prisma`, {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'pipe',
  });

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      PrismaModule,
      AuthModule,
      UsersModule,
      PatientsModule,
      EncountersModule,
      ConditionsModule,
      AttachmentsModule,
      ConsentsModule,
      AuditModule,
      SettingsModule,
    ],
    controllers: [HealthController],
  }).compile();

  prisma = moduleFixture.get(PrismaService);
  alertsService = moduleFixture.get(AlertsService);

  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use(requestTracingMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();

  httpServer = app.getHttpServer();
}

export async function teardownApp() {
  if (app) {
    await app.close();
  }

  if (testDatabaseFilePath) {
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      const candidatePath = `${testDatabaseFilePath}${suffix}`;
      if (fs.existsSync(candidatePath)) {
        fs.rmSync(candidatePath, { force: true });
      }
    }
  }

  if (testSchemaSqlPath && fs.existsSync(testSchemaSqlPath)) {
    fs.rmSync(testSchemaSqlPath, { force: true });
  }

  if (testUploadsDirectory && fs.existsSync(testUploadsDirectory)) {
    fs.rmSync(testUploadsDirectory, { recursive: true, force: true });
  }
}
