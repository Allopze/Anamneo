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
import { execFileSync, execSync } from 'child_process';
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
import { AnalyticsModule } from '../../src/analytics/analytics.module';
import { TemplatesModule } from '../../src/templates/templates.module';
import { OnboardingModule } from '../../src/onboarding/onboarding.module';
import { HealthController } from '../../src/health.controller';
import { requestTracingMiddleware } from '../../src/common/utils/request-tracing';

// ── Test database URL resolution ────────────────────────────────────

function loadEnvFileIfPresent(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rawValueParts] = trimmed.split('=');
    if (process.env[key]) continue;
    const rawValue = rawValueParts.join('=').trim();
    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
}

loadEnvFileIfPresent(path.resolve(__dirname, '../../.env'));
loadEnvFileIfPresent(path.resolve(__dirname, '../../../.env'));

const TEST_DB_NAME = `anamneo_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const DEFAULT_TEST_DATABASE_URL = `postgresql://anamneo_owner:anamneo_owner@localhost:5432/${TEST_DB_NAME}?schema=public`;

function resolveBaseTestDatabaseUrl() {
  const explicitTestUrl = process.env.TEST_DATABASE_URL;
  if (explicitTestUrl?.startsWith('postgresql://') || explicitTestUrl?.startsWith('postgres://')) {
    return explicitTestUrl;
  }
  return DEFAULT_TEST_DATABASE_URL;
}

function parseDatabaseName(databaseUrl: string): string {
  return new URL(databaseUrl).pathname.replace(/^\//, '');
}

function buildDatabaseUrlWithName(databaseUrl: string, databaseName: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function buildMaintenanceDatabaseUrl(databaseUrl: string) {
  const url = new URL(buildDatabaseUrlWithName(databaseUrl, 'postgres'));
  url.searchParams.delete('schema');
  return url.toString();
}

function createTestDatabase(databaseUrl: string) {
  const databaseName = parseDatabaseName(databaseUrl);
  const maintenanceUrl = buildMaintenanceDatabaseUrl(databaseUrl);
  execFileSync('dropdb', ['--if-exists', `--maintenance-db=${maintenanceUrl}`, databaseName], { stdio: 'pipe' });
  execFileSync('createdb', [`--maintenance-db=${maintenanceUrl}`, databaseName], { stdio: 'pipe' });
}

function dropTestDatabase(databaseUrl: string) {
  const databaseName = parseDatabaseName(databaseUrl);
  const maintenanceUrl = buildMaintenanceDatabaseUrl(databaseUrl);
  execFileSync('dropdb', ['--if-exists', `--maintenance-db=${maintenanceUrl}`, databaseName], { stdio: 'pipe' });
}

// ── Shared mutable state ────────────────────────────────────────────

export const state = {
  medicoUserId: '',
  assistantUserId: '',
  patientId: '',
  quickPatientId: '',
  duplicatePatientId: '',
  blockedPatientId: '',
  encounterId: '',
  blockedEncounterId: '',
  assistantEncounterId: '',
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
  medicoRecoveryCodes: [] as string[],
  medicoTempToken: '',
  revokedInvitationId: '',
  revokedInvitationToken: '',
};

export const TEST_LEGAL_ACCEPTANCE = {
  acceptedTermsVersion: '2026-05-02',
  acceptedPrivacyVersion: '2026-05-02',
} as const;

const TEST_LEGAL_CONTENT = JSON.stringify({
  summary: ['Documento legal vigente para pruebas e2e.'],
  sections: [
    {
      id: 'alcance',
      title: 'Alcance',
      body: ['Contenido mínimo requerido para validar aceptación legal en registro.'],
    },
  ],
  contactEmail: 'soporte@anamneo.cl',
});

// ── App references ──────────────────────────────────────────────────

let app: INestApplication;
let httpServer: any;
let testDatabaseUrl: string | null = null;
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

export function getApp() {
  return app;
}

// ── Bootstrap / Teardown ────────────────────────────────────────────

export async function bootstrapApp() {
  testDatabaseUrl = resolveBaseTestDatabaseUrl();
  testUploadsDirectory = path.join(__dirname, '..', `uploads-e2e-${Date.now()}`);

  createTestDatabase(testDatabaseUrl);
  fs.mkdirSync(testUploadsDirectory, { recursive: true });

  // Set env vars for test
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.MIGRATION_DATABASE_URL = testDatabaseUrl;
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

  execSync('node ./node_modules/prisma/build/index.js generate', {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl, MIGRATION_DATABASE_URL: testDatabaseUrl },
    stdio: 'pipe',
  });

  execSync(
    'node ./node_modules/prisma/build/index.js migrate deploy --schema ./prisma/schema.prisma',
    {
      cwd: path.join(__dirname, '..', '..'),
      env: { ...process.env, DATABASE_URL: testDatabaseUrl, MIGRATION_DATABASE_URL: testDatabaseUrl },
      stdio: 'pipe',
    },
  );

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
      AnalyticsModule,
      TemplatesModule,
      OnboardingModule,
    ],
    controllers: [HealthController],
  }).compile();

  prisma = moduleFixture.get(PrismaService);
  alertsService = moduleFixture.get(AlertsService);

  const legalFixtureTimestamp = new Date('2026-05-02T00:00:00.000Z');
  await prisma.$executeRawUnsafe(
    'INSERT INTO legal_documents (id, type, version, status, title, description, content_json, effective_at, published_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10), ($11, $12, $13, $14, $15, $16, $17, $18, $19, $20)',
    'e2e-terms-2026-05-02',
    'TERMS',
    TEST_LEGAL_ACCEPTANCE.acceptedTermsVersion,
    'PUBLISHED',
    'Términos y Condiciones de Servicio',
    'Documento de términos vigente para pruebas.',
    TEST_LEGAL_CONTENT,
    legalFixtureTimestamp,
    legalFixtureTimestamp,
    legalFixtureTimestamp,
    'e2e-privacy-2026-05-02',
    'PRIVACY',
    TEST_LEGAL_ACCEPTANCE.acceptedPrivacyVersion,
    'PUBLISHED',
    'Política de Privacidad',
    'Documento de privacidad vigente para pruebas.',
    TEST_LEGAL_CONTENT,
    legalFixtureTimestamp,
    legalFixtureTimestamp,
    legalFixtureTimestamp,
  );

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

  if (testDatabaseUrl) {
    dropTestDatabase(testDatabaseUrl);
  }

  if (testUploadsDirectory && fs.existsSync(testUploadsDirectory)) {
    fs.rmSync(testUploadsDirectory, { recursive: true, force: true });
  }
}
