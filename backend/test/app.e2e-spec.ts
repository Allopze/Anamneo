import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { PatientsModule } from '../src/patients/patients.module';
import { EncountersModule } from '../src/encounters/encounters.module';
import { ConditionsModule } from '../src/conditions/conditions.module';
import { AttachmentsModule } from '../src/attachments/attachments.module';
import { ConsentsModule } from '../src/consents/consents.module';
import { AlertsService } from '../src/alerts/alerts.service';
import { AuditModule } from '../src/audit/audit.module';
import { SettingsModule } from '../src/settings/settings.module';
import { HealthController } from '../src/health.controller';
import { requestTracingMiddleware } from '../src/common/utils/request-tracing';
import { ENCOUNTER_SECTION_ORDER, getEncounterSectionSchemaVersion } from '../src/common/utils/encounter-section-meta';

// ── Test database setup ─────────────────────────────────────────────
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

  const prismaDirectory = path.join(__dirname, '..', 'prisma');
  const normalizedRelativePath = rawPath.replace(/^\.\//, '');
  return path.resolve(prismaDirectory, normalizedRelativePath);
}

describe('Application E2E Tests', () => {
  let app: INestApplication;
  let httpServer: any;
  let prisma: PrismaService;
  let alertsService: AlertsService;
  let testDatabaseFilePath: string | null = null;
  let testSchemaSqlPath: string | null = null;
  let testUploadsDirectory: string | null = null;

  // Stored IDs used across tests
  let medicoUserId: string;
  let assistantUserId: string;
  let patientId: string;
  let quickPatientId: string;
  let blockedPatientId: string;
  let encounterId: string;
  let blockedEncounterId: string;
  let workflowEncounterId: string;
  let patientProblemId: string;
  let patientTaskId: string;
  let attachmentId: string;
  let localConditionId: string;
  let secondLocalConditionId: string;

  // Cookie jars for different users
  let adminCookies: string[] = [];
  let medicoCookies: string[] = [];
  let assistantCookies: string[] = [];
  let medicoInvitationToken: string;
  let revokedInvitationId: string;
  let revokedInvitationToken: string;

  beforeAll(async () => {
    const testDatabaseUrl = resolveBaseTestDatabaseUrl();
    testDatabaseFilePath = resolveSqliteFilePath(testDatabaseUrl);
    testSchemaSqlPath = path.join(__dirname, `schema-e2e-${Date.now()}.sql`);
    testUploadsDirectory = path.join(__dirname, `uploads-e2e-${Date.now()}`);

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
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'pipe',
    });

    // Build SQL from schema and execute it against the temporary SQLite DB.
    const schemaSql = execSync(
      'npx prisma migrate diff --from-empty --to-schema-datamodel ./prisma/schema.prisma --script',
      {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: testDatabaseUrl },
        stdio: 'pipe',
      },
    ).toString();

    fs.writeFileSync(testSchemaSqlPath, schemaSql, 'utf8');

    execSync(`npx prisma db execute --file "${testSchemaSqlPath}" --schema ./prisma/schema.prisma`, {
      cwd: path.join(__dirname, '..'),
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
  }, 30_000);

  afterAll(async () => {
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
  });

  // ── Helpers ─────────────────────────────────────────────────────────

  function extractCookies(res: request.Response): string[] {
    const setCookie = res.headers['set-cookie'];
    if (!setCookie) return [];
    return Array.isArray(setCookie) ? setCookie : [setCookie];
  }

  function cookieHeader(cookies: string[]): string {
    return cookies.map((c) => c.split(';')[0]).join('; ');
  }

  function req() {
    return request(httpServer);
  }

  // ── 1. Health Check ─────────────────────────────────────────────────

  describe('Health', () => {
    it('GET /api/health → 200', async () => {
      const res = await req().get('/api/health').expect(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /api/health/sqlite → 401 when unauthenticated', async () => {
      await req().get('/api/health/sqlite').expect(401);
    });
  });

  // ── 2. Auth: Bootstrap ──────────────────────────────────────────────

  describe('Auth - Bootstrap', () => {
    it('GET /api/auth/bootstrap → empty DB', async () => {
      const res = await req().get('/api/auth/bootstrap').expect(200);
      expect(res.body.isEmpty).toBe(true);
      expect(res.body.userCount).toBe(0);
    });
  });

  // ── 3. Auth: Register first user (Admin) ────────────────────────────

  describe('Auth - Register Admin', () => {
    it('POST /api/auth/register → first user becomes admin', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({
          email: 'admin@test.com',
          password: 'Admin123',
          nombre: 'Admin Test',
          role: 'ADMIN',
        })
        .expect(201);

      expect(res.body.message).toBe('Registro exitoso');
      adminCookies = extractCookies(res);
      expect(adminCookies.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/auth/me → returns admin user', async () => {
      const res = await req().get('/api/auth/me').set('Cookie', cookieHeader(adminCookies)).expect(200);

      expect(res.body.email).toBe('admin@test.com');
      expect(res.body.isAdmin).toBe(true);
    });

    it('GET /api/health/sqlite → 200 for admin with operational payload', async () => {
      const res = await req().get('/api/health/sqlite').set('Cookie', cookieHeader(adminCookies)).expect(200);

      expect(['ok', 'degraded']).toContain(res.body.status);
      expect(res.body.database?.status).toBe('ok');
      expect(res.body.sqlite).toBeDefined();
      expect(typeof res.body.sqlite.enabled).toBe('boolean');
    });
  });

  // ── 4. Auth: Invite and Register a Medico ───────────────────────────

  describe('Auth - Register Medico', () => {
    it('POST /api/auth/register → rejects public registration after bootstrap', async () => {
      await req()
        .post('/api/auth/register')
        .send({
          email: 'medico@test.com',
          password: 'Medico123',
          nombre: 'Dr. Test',
          role: 'MEDICO',
        })
        .expect(403);
    });

    it('POST /api/users/invitations → admin can invite medico', async () => {
      const res = await req()
        .post('/api/users/invitations')
        .set('Cookie', cookieHeader(adminCookies))
        .send({
          email: 'medico@test.com',
          role: 'MEDICO',
        })
        .expect(201);

      expect(res.body.token).toBeDefined();
      expect(res.body.emailSent).toBe(false);
      expect(res.body.inviteUrl).toBe(`http://localhost:5555/register?token=${res.body.token}`);
      medicoInvitationToken = res.body.token;
    });

    it('GET /api/auth/invitations/:token → validates invitation', async () => {
      const res = await req().get(`/api/auth/invitations/${medicoInvitationToken}`).expect(200);

      expect(res.body.email).toBe('medico@test.com');
      expect(res.body.role).toBe('MEDICO');
    });

    it('POST /api/users/invitations → admin can create a second pending invitation', async () => {
      const res = await req()
        .post('/api/users/invitations')
        .set('Cookie', cookieHeader(adminCookies))
        .send({
          email: 'medico-revoked@test.com',
          role: 'MEDICO',
        })
        .expect(201);

      revokedInvitationId = res.body.id;
      revokedInvitationToken = res.body.token;
    });

    it('GET /api/users/invitations → admin lists pending invitations', async () => {
      const res = await req().get('/api/users/invitations').set('Cookie', cookieHeader(adminCookies)).expect(200);

      const invitation = res.body.find((item: any) => item.id === revokedInvitationId);

      expect(invitation).toBeDefined();
      expect(invitation.revokedAt).toBeNull();
      expect(invitation.acceptedAt).toBeNull();
    });

    it('DELETE /api/users/invitations/:id → admin revokes pending invitation', async () => {
      const res = await req()
        .delete(`/api/users/invitations/${revokedInvitationId}`)
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(res.body.id).toBe(revokedInvitationId);
      expect(res.body.revokedAt).toBeDefined();
    });

    it('GET /api/auth/invitations/:token → rejects revoked invitation', async () => {
      await req().get(`/api/auth/invitations/${revokedInvitationToken}`).expect(403);
    });

    it('POST /api/auth/register → medico user with invitation', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({
          email: 'medico@test.com',
          password: 'Medico123',
          nombre: 'Dr. Test',
          role: 'MEDICO',
          invitationToken: medicoInvitationToken,
        })
        .expect(201);

      medicoCookies = extractCookies(res);
    });

    it('GET /api/auth/me → returns medico user', async () => {
      const res = await req().get('/api/auth/me').set('Cookie', cookieHeader(medicoCookies)).expect(200);

      expect(res.body.email).toBe('medico@test.com');
      expect(res.body.role).toBe('MEDICO');
      medicoUserId = res.body.id;
    });
  });

  describe('Auth - Register Assistant', () => {
    it('POST /api/users → admin can create assigned assistant', async () => {
      const res = await req()
        .post('/api/users')
        .set('Cookie', cookieHeader(adminCookies))
        .send({
          email: 'assistant@test.com',
          password: 'Assist123',
          nombre: 'Asistente Test',
          role: 'ASISTENTE',
          medicoId: medicoUserId,
        })
        .expect(201);

      assistantUserId = res.body.id;
      expect(res.body.email).toBe('assistant@test.com');
      expect(res.body.medicoId).toBe(medicoUserId);
    });

    it('POST /api/auth/login → assistant can login', async () => {
      const res = await req()
        .post('/api/auth/login')
        .send({ email: 'assistant@test.com', password: 'Assist123' })
        .expect(200);

      assistantCookies = extractCookies(res);
      expect(assistantCookies.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/auth/me → returns assigned assistant user', async () => {
      const res = await req().get('/api/auth/me').set('Cookie', cookieHeader(assistantCookies)).expect(200);

      expect(res.body.role).toBe('ASISTENTE');
      expect(res.body.medicoId).toBe(medicoUserId);
    });
  });

  // ── 5. Conditions ───────────────────────────────────────────────────

  describe('Conditions', () => {
    it('POST /api/conditions/import/csv → admin can import global csv', async () => {
      const res = await req()
        .post('/api/conditions/import/csv')
        .set('Cookie', cookieHeader(adminCookies))
        .attach('file', Buffer.from('name\nHipertension\nDiabetes\n'), {
          filename: 'conditions.csv',
          contentType: 'text/csv',
        })
        .expect(201);

      expect(res.body.total).toBe(2);
      expect(res.body.created).toBe(2);
    });

    it('POST /api/conditions/import/csv → medico cannot import global csv', async () => {
      await req()
        .post('/api/conditions/import/csv')
        .set('Cookie', cookieHeader(medicoCookies))
        .attach('file', Buffer.from('name\nAsma\n'), {
          filename: 'conditions.csv',
          contentType: 'text/csv',
        })
        .expect(403);
    });

    it('POST /api/conditions/local → assistant can add a local condition once', async () => {
      const res = await req()
        .post('/api/conditions/local')
        .set('Cookie', cookieHeader(assistantCookies))
        .send({ name: 'Migraña' })
        .expect(201);

      expect(res.body.name).toBe('Migraña');
      expect(res.body.scope).toBe('LOCAL');
      expect(res.body.deduplicatedByName).toBeUndefined();
      localConditionId = res.body.id;
    });

    it('POST /api/conditions/local → normalized duplicates reuse the existing local condition', async () => {
      const res = await req()
        .post('/api/conditions/local')
        .set('Cookie', cookieHeader(assistantCookies))
        .send({ name: '  migrana  ' })
        .expect(201);

      expect(res.body.id).toBe(localConditionId);
      expect(res.body.name).toBe('migrana');
      expect(res.body.deduplicatedByName).toBe(true);
    });

    it('POST /api/conditions/local → can create a second distinct local condition', async () => {
      const res = await req()
        .post('/api/conditions/local')
        .set('Cookie', cookieHeader(assistantCookies))
        .send({ name: 'Asma bronquial' })
        .expect(201);

      expect(res.body.name).toBe('Asma bronquial');
      secondLocalConditionId = res.body.id;
    });

    it('PUT /api/conditions/local/:id → rejects renaming to an existing normalized local condition', async () => {
      await req()
        .put(`/api/conditions/local/${secondLocalConditionId}`)
        .set('Cookie', cookieHeader(assistantCookies))
        .send({ name: 'migraña' })
        .expect(400);
    });
  });

  // ── 6. Auth: Login ──────────────────────────────────────────────────

  describe('Auth - Login', () => {
    it('POST /api/auth/login → valid credentials', async () => {
      const res = await req()
        .post('/api/auth/login')
        .send({ email: 'medico@test.com', password: 'Medico123' })
        .expect(200);

      expect(res.body.message).toBe('Inicio de sesión exitoso');
      medicoCookies = extractCookies(res);
    });

    it('POST /api/auth/login → invalid credentials', async () => {
      await req().post('/api/auth/login').send({ email: 'medico@test.com', password: 'WrongPass1' }).expect(401);
    });
  });

  // ── 7. Auth: Profile & Password ─────────────────────────────────────

  describe('Auth - Profile', () => {
    it('PATCH /api/auth/profile → update name', async () => {
      const res = await req()
        .patch('/api/auth/profile')
        .set('Cookie', cookieHeader(medicoCookies))
        .send({ nombre: 'Dr. Updated' })
        .expect(200);

      expect(res.body.nombre).toBe('Dr. Updated');
    });

    it('POST /api/auth/change-password → wrong current password', async () => {
      await req()
        .post('/api/auth/change-password')
        .set('Cookie', cookieHeader(medicoCookies))
        .send({ currentPassword: 'WrongPass1', newPassword: 'NewPass123' })
        .expect(409);
    });

    it('POST /api/auth/change-password → rejects spaces in new password', async () => {
      await req()
        .post('/api/auth/change-password')
        .set('Cookie', cookieHeader(medicoCookies))
        .send({ currentPassword: 'Medico123', newPassword: 'New Pass123' })
        .expect(400);
    });

    it('POST /api/auth/change-password → success with dot in password', async () => {
      const res = await req()
        .post('/api/auth/change-password')
        .set('Cookie', cookieHeader(medicoCookies))
        .send({ currentPassword: 'Medico123', newPassword: 'New.Pass123' })
        .expect(200);

      expect(res.body.message).toBe('Contraseña actualizada correctamente');
    });

    it('POST /api/auth/login → works with new password', async () => {
      const res = await req()
        .post('/api/auth/login')
        .send({ email: 'medico@test.com', password: 'New.Pass123' })
        .expect(200);

      medicoCookies = extractCookies(res);
    });
  });

  // ── 8. Auth: Logout ─────────────────────────────────────────────────

  describe('Auth - Logout', () => {
    it('POST /api/auth/logout → clears cookies', async () => {
      const res = await req().post('/api/auth/logout').expect(200);
      expect(res.body.message).toBe('Sesión cerrada');
    });

    it('GET /api/auth/me → 401 without cookies', async () => {
      await req().get('/api/auth/me').expect(401);
    });

    // Re-login for subsequent tests
    it('re-login medico', async () => {
      const res = await req()
        .post('/api/auth/login')
        .send({ email: 'medico@test.com', password: 'New.Pass123' })
        .expect(200);

      medicoCookies = extractCookies(res);
    });
  });

  // ── 9. Patients CRUD ────────────────────────────────────────────────

  describe('Patients', () => {
    it('POST /api/patients → create patient', async () => {
      const res = await req()
        .post('/api/patients')
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          rut: '12.345.678-5',
          nombre: 'Paciente Test',
          edad: 35,
          sexo: 'MASCULINO',
          prevision: 'FONASA',
          trabajo: 'Ingeniero',
          domicilio: 'Santiago',
        })
        .expect(201);

      expect(res.body.nombre).toBe('Paciente Test');
      expect(res.body.registrationMode).toBe('COMPLETO');
      expect(res.body.completenessStatus).toBe('VERIFICADA');
      expect(res.body.id).toBeDefined();
      patientId = res.body.id;
    });

    it('POST /api/patients/quick → assistant creates an intentionally incomplete patient', async () => {
      const res = await req()
        .post('/api/patients/quick')
        .set('Cookie', cookieHeader(assistantCookies))
        .send({
          nombre: 'Paciente Recepción',
          rutExempt: true,
          rutExemptReason: 'Extranjero sin identificación chilena',
        })
        .expect(201);

      expect(res.body.nombre).toBe('Paciente Recepción');
      expect(res.body.edad).toBeNull();
      expect(res.body.sexo).toBeNull();
      expect(res.body.prevision).toBeNull();
      expect(res.body.registrationMode).toBe('RAPIDO');
      expect(res.body.completenessStatus).toBe('INCOMPLETA');
      expect(res.body.demographicsMissingFields).toEqual(expect.arrayContaining(['edad', 'sexo', 'prevision']));
      quickPatientId = res.body.id;
    });

    it('GET /api/patients → list patients', async () => {
      const res = await req().get('/api/patients').set('Cookie', cookieHeader(medicoCookies)).expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/patients/:id → get patient', async () => {
      const res = await req().get(`/api/patients/${patientId}`).set('Cookie', cookieHeader(medicoCookies)).expect(200);

      expect(res.body.nombre).toBe('Paciente Test');
      expect(res.body.history).toBeDefined();
    });

    it('PUT /api/patients/:id → update patient', async () => {
      const res = await req()
        .put(`/api/patients/${patientId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({ nombre: 'Paciente Actualizado', edad: 36 })
        .expect(200);

      expect(res.body.nombre).toBe('Paciente Actualizado');
      expect(res.body.edad).toBe(36);
    });

    it('PUT /api/patients/:id/history → rejects malformed history payloads', async () => {
      await req()
        .put(`/api/patients/${patientId}/history`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          antecedentesMedicos: {
            texto: 'Hipertensión arterial',
            severidad: 'alta',
          },
        })
        .expect(400);
    });

    it('PUT /api/patients/:id/history → sanitizes and persists the patient master history', async () => {
      const res = await req()
        .put(`/api/patients/${patientId}/history`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          antecedentesMedicos: {
            texto: '  Hipertensión arterial en tratamiento  ',
            items: ['HTA', 'HTA', '  '],
          },
          alergias: {
            items: ['Penicilina', ' Penicilina ', 'Polen'],
          },
          medicamentos: {
            texto: '  Losartán 50 mg cada 12 horas  ',
          },
        })
        .expect(200);

      expect(JSON.parse(res.body.antecedentesMedicos)).toEqual({
        texto: 'Hipertensión arterial en tratamiento',
        items: ['HTA'],
      });
      expect(JSON.parse(res.body.alergias)).toEqual({
        items: ['Penicilina', 'Polen'],
      });
      expect(JSON.parse(res.body.medicamentos)).toEqual({
        texto: 'Losartán 50 mg cada 12 horas',
      });
    });

    it('PUT /api/patients/:id/history → assigned assistant can edit patient master history', async () => {
      const res = await req()
        .put(`/api/patients/${patientId}/history`)
        .set('Cookie', cookieHeader(assistantCookies))
        .send({
          antecedentesFamiliares: {
            texto: 'Diabetes mellitus en madre',
          },
        })
        .expect(200);

      expect(JSON.parse(res.body.antecedentesFamiliares)).toEqual({
        texto: 'Diabetes mellitus en madre',
      });
    });

    it('PUT /api/patients/:id/admin → assigned assistant can edit patient admin fields', async () => {
      const res = await req()
        .put(`/api/patients/${patientId}/admin`)
        .set('Cookie', cookieHeader(assistantCookies))
        .send({
          trabajo: 'Ingeniero clínico',
        })
        .expect(200);

      expect(res.body.trabajo).toBe('Ingeniero clínico');
    });

    it('PUT /api/patients/:id/admin → assistant completes quick registration and leaves it pending medical verification', async () => {
      const res = await req()
        .put(`/api/patients/${quickPatientId}/admin`)
        .set('Cookie', cookieHeader(assistantCookies))
        .send({
          edad: 28,
          sexo: 'FEMENINO',
          prevision: 'FONASA',
          trabajo: 'Técnica en laboratorio',
        })
        .expect(200);

      expect(res.body.completenessStatus).toBe('PENDIENTE_VERIFICACION');
      expect(res.body.demographicsVerifiedAt).toBeNull();
      expect(res.body.demographicsVerifiedById).toBeNull();
      expect(res.body.demographicsMissingFields).toEqual([]);
    });

    it('GET /api/encounters/stats/dashboard → exposes operational patient completeness counts', async () => {
      const res = await req()
        .get('/api/encounters/stats/dashboard')
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.counts.patientPendingVerification).toBeGreaterThanOrEqual(1);
      expect(res.body.counts.patientVerified).toBeGreaterThanOrEqual(1);
      expect(res.body.counts.patientNonVerified).toBeGreaterThanOrEqual(res.body.counts.patientPendingVerification);
    });

    it('GET /api/patients?completenessStatus=... → filters rows and returns operational summary counts', async () => {
      const res = await req()
        .get('/api/patients?completenessStatus=PENDIENTE_VERIFICACION')
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((patient: any) => patient.completenessStatus === 'PENDIENTE_VERIFICACION')).toBe(true);
      expect(res.body.data.some((patient: any) => patient.id === quickPatientId)).toBe(true);
      expect(res.body.summary.pendingVerification).toBeGreaterThanOrEqual(1);
      expect(res.body.summary.verified).toBeGreaterThanOrEqual(1);
      expect(res.body.summary.totalPatients).toBeGreaterThan(res.body.data.length);
    });

    it('POST /api/patients/:id/verify-demographics → doctor verifies a completed quick registration', async () => {
      const res = await req()
        .post(`/api/patients/${quickPatientId}/verify-demographics`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(201);

      expect(res.body.registrationMode).toBe('RAPIDO');
      expect(res.body.completenessStatus).toBe('VERIFICADA');
      expect(res.body.demographicsVerifiedAt).toBeTruthy();
      expect(res.body.demographicsVerifiedById).toBeDefined();
    });

    it('GET /api/patients/:id/admin-summary → keeps the real assistant as creator for quick registrations', async () => {
      const res = await req()
        .get(`/api/patients/${quickPatientId}/admin-summary`)
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(res.body.createdBy).toMatchObject({
        id: assistantUserId,
        nombre: 'Asistente Test',
        email: 'assistant@test.com',
      });
    });

    it('PUT /api/patients/:id/history → admin gets 403 because history is clinical', async () => {
      await req()
        .put(`/api/patients/${patientId}/history`)
        .set('Cookie', cookieHeader(adminCookies))
        .send({
          antecedentesPersonales: {
            texto: 'Observación administrativa validada por admin',
          },
        })
        .expect(403);
    });

    it('GET /api/patients/:id → admin gets 403 because the detail is clinical', async () => {
      await req().get(`/api/patients/${patientId}`).set('Cookie', cookieHeader(adminCookies)).expect(403);
    });

    it('GET /api/patients/:id/clinical-summary → admin gets 403 because the summary is clinical', async () => {
      await req()
        .get(`/api/patients/${patientId}/clinical-summary`)
        .set('Cookie', cookieHeader(adminCookies))
        .expect(403);
    });

    it('GET /api/patients/:id/admin-summary → admin gets a reduced non-clinical patient view', async () => {
      const res = await req()
        .get(`/api/patients/${patientId}/admin-summary`)
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(res.body.nombre).toBe('Paciente Actualizado');
      expect(res.body.metrics.encounterCount).toBe(0);
      expect(res.body.createdBy).toMatchObject({
        id: medicoUserId,
        nombre: 'Dr. Updated',
        email: 'medico@test.com',
      });
      expect(res.body.centroMedico).toBeNull();
      expect(res.body.history).toBeUndefined();
      expect(res.body.problems).toBeUndefined();
      expect(res.body.tasks).toBeUndefined();
    });

    it('GET /api/patients/:id/admin-summary → medico gets 403 because the view is administrative only', async () => {
      await req()
        .get(`/api/patients/${patientId}/admin-summary`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(403);
    });

    it('GET /api/patients?search=Actualizado → search works', async () => {
      const res = await req()
        .get('/api/patients?search=Actualizado')
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.data.length).toBe(1);
    });

    it('DELETE /api/patients/:id → archive patient', async () => {
      const res = await req()
        .delete(`/api/patients/${patientId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.message).toBe('Paciente archivado correctamente');
    });

    it('GET /api/patients/:id → 404 when patient is archived', async () => {
      await req().get(`/api/patients/${patientId}`).set('Cookie', cookieHeader(medicoCookies)).expect(404);
    });

    it('POST /api/patients/:id/restore → restore archived patient', async () => {
      const res = await req()
        .post(`/api/patients/${patientId}/restore`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(201);

      expect(res.body.message).toBe('Paciente restaurado correctamente');
    });

    it('GET /api/patients/:id → available again after restore', async () => {
      const res = await req().get(`/api/patients/${patientId}`).set('Cookie', cookieHeader(medicoCookies)).expect(200);

      expect(res.body.id).toBe(patientId);
    });
  });

  // ── 9. Encounters ───────────────────────────────────────────────────

  describe('Encounters', () => {
    it('POST /api/encounters/patient/:patientId → create encounter', async () => {
      const res = await req()
        .post(`/api/encounters/patient/${patientId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({})
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('EN_PROGRESO');
      encounterId = res.body.id;
    });

    it('POST /api/encounters/patient/:patientId → initializes anamnesis remota as a sanitized snapshot', async () => {
      const res = await req()
        .get(`/api/encounters/${encounterId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      const anamnesisRemota = res.body.sections.find((section: any) => section.sectionKey === 'ANAMNESIS_REMOTA')?.data;
      expect(anamnesisRemota).toMatchObject({
        readonly: true,
        antecedentesMedicos: {
          texto: 'Hipertensión arterial en tratamiento',
          items: ['HTA'],
        },
        alergias: {
          items: ['Penicilina', 'Polen'],
        },
        medicamentos: {
          texto: 'Losartán 50 mg cada 12 horas',
        },
      });
      expect(anamnesisRemota.id).toBeUndefined();
      expect(anamnesisRemota.patientId).toBeUndefined();
      expect(anamnesisRemota.updatedAt).toBeUndefined();
    });

    it('GET /api/encounters → list encounters', async () => {
      const res = await req().get('/api/encounters').set('Cookie', cookieHeader(medicoCookies)).expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/encounters → admin gets 403 because the encounter list is clinical', async () => {
      await req().get('/api/encounters').set('Cookie', cookieHeader(adminCookies)).expect(403);
    });

    it('GET /api/encounters/:id → get encounter with sections', async () => {
      const res = await req()
        .get(`/api/encounters/${encounterId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.id).toBe(encounterId);
      expect(res.body.sections).toBeDefined();
      expect(
        res.body.sections.every(
          (section: any) => section.schemaVersion === getEncounterSectionSchemaVersion(section.sectionKey),
        ),
      ).toBe(true);
      expect(
        res.body.sections.find((section: any) => section.sectionKey === 'OBSERVACIONES')?.data?.resumenClinico,
      ).toBe('');
    });

    it('GET /api/encounters/:id → reports divergence between identification snapshot and patient master data', async () => {
      await req()
        .put(`/api/patients/${patientId}/admin`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          prevision: 'ISAPRE',
          domicilio: 'Nueva dirección 456',
        })
        .expect(200);

      const res = await req()
        .get(`/api/encounters/${encounterId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.identificationSnapshotStatus?.isSnapshot).toBe(true);
      expect(res.body.identificationSnapshotStatus?.hasDifferences).toBe(true);
      expect(res.body.identificationSnapshotStatus?.differingFields).toEqual(
        expect.arrayContaining(['prevision', 'domicilio']),
      );
    });

    it('PUT /api/encounters/:id/sections/IDENTIFICACION → rejects invalid clinical admin data', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/IDENTIFICACION`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            nombre: 'Paciente Actualizado',
            edad: 'abc',
            sexo: 'DESCONOCIDO',
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/IDENTIFICACION → rejects manual divergence from patient master data', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/IDENTIFICACION`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            nombre: 'Otro nombre',
            edad: 36,
            sexo: 'FEMENINO',
            prevision: 'FONASA',
            rut: '',
            rutExempt: true,
            rutExemptReason: 'Documento no disponible',
            trabajo: '',
            domicilio: '',
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/MOTIVO_CONSULTA → update section', async () => {
      const res = await req()
        .put(`/api/encounters/${encounterId}/sections/MOTIVO_CONSULTA`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: { texto: 'Dolor abdominal agudo' },
          completed: true,
        })
        .expect(200);

      expect(res.body.sectionKey).toBe('MOTIVO_CONSULTA');
      expect(res.body.completed).toBe(true);
    });

    it('PUT /api/encounters/:id/sections/MOTIVO_CONSULTA → rejects invalid assisted-classification payload', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/MOTIVO_CONSULTA`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            texto: 'Dolor abdominal agudo',
            modoSeleccion: 'BOT',
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/ANAMNESIS_PROXIMA → rejects non-text fields', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/ANAMNESIS_PROXIMA`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            inicio: { texto: 'Hace tres días' },
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/ANAMNESIS_REMOTA → rejects malformed remote history payloads', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/ANAMNESIS_REMOTA`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            readonly: 'true',
            antecedentesMedicos: {
              items: ['HTA', { nombre: 'asma' }],
            },
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/REVISION_SISTEMAS → rejects invalid system flags', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/REVISION_SISTEMAS`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            respiratorio: {
              checked: 'true',
              notas: 'Disnea de esfuerzo',
            },
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/EXAMEN_FISICO → rejects out-of-range vital signs', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/EXAMEN_FISICO`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            signosVitales: {
              saturacionOxigeno: '140',
            },
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/EXAMEN_FISICO → returns a warning when auto-alert generation fails but the section still saves', async () => {
      const spy = jest.spyOn(alertsService, 'checkVitalSigns').mockRejectedValueOnce(new Error('simulated failure'));

      const res = await req()
        .put(`/api/encounters/${encounterId}/sections/EXAMEN_FISICO`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            signosVitales: {
              presionArterial: '180/120',
              temperatura: '39.6',
            },
          },
          completed: true,
        })
        .expect(200);

      expect(res.body.sectionKey).toBe('EXAMEN_FISICO');
      expect(res.body.warnings).toEqual([
        'La sección se guardó, pero no se pudo completar la verificación automática de alertas por signos vitales.',
      ]);

      spy.mockRestore();
    });

    it('PUT /api/encounters/:id/sections/EXAMEN_FISICO → does not recreate acknowledged auto-alerts for the same critical value', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/EXAMEN_FISICO`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            signosVitales: {
              temperatura: '39.6',
            },
          },
          completed: true,
        })
        .expect(200);

      const initialAlertsRes = await req()
        .get(`/api/alerts/patient/${patientId}?includeAcknowledged=true`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      const matchingAlerts = initialAlertsRes.body.filter(
        (alert: any) => alert.message === 'Temperatura crítica: 39.6°C',
      );

      expect(matchingAlerts).toHaveLength(1);

      await req()
        .post(`/api/alerts/${matchingAlerts[0].id}/acknowledge`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(201);

      await req()
        .put(`/api/encounters/${encounterId}/sections/EXAMEN_FISICO`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            signosVitales: {
              temperatura: '39.6',
            },
          },
          completed: true,
        })
        .expect(200);

      const afterRepeatRes = await req()
        .get(`/api/alerts/patient/${patientId}?includeAcknowledged=true`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(
        afterRepeatRes.body.filter((alert: any) => alert.message === 'Temperatura crítica: 39.6°C'),
      ).toHaveLength(1);
    });

    it('PUT /api/encounters/:id/sections/SOSPECHA_DIAGNOSTICA → rejects malformed ranked diagnoses', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/SOSPECHA_DIAGNOSTICA`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            sospechas: [
              {
                diagnostico: 'Apendicitis',
                notas: 'Dolor en fosa iliaca derecha',
              },
            ],
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/TRATAMIENTO → rejects invalid structured order status', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/TRATAMIENTO`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            examenesEstructurados: [
              {
                id: 'exam-invalido',
                nombre: 'Perfil bioquímico',
                estado: 'ENVIADO',
              },
            ],
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/TRATAMIENTO → store structured exam orders', async () => {
      const res = await req()
        .put(`/api/encounters/${encounterId}/sections/TRATAMIENTO`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            plan: 'Solicitar examenes y reevaluar.',
            medicamentosEstructurados: [
              {
                id: 'med-vacio',
                nombre: '',
                dosis: '',
                frecuencia: '',
                duracion: '',
              },
            ],
            examenesEstructurados: [
              {
                id: 'exam-hemograma',
                nombre: 'Hemograma completo',
                indicacion: 'Control de anemia',
                estado: 'PENDIENTE',
              },
              {
                id: 'exam-vacio',
                nombre: '',
                indicacion: '',
                estado: 'PENDIENTE',
              },
            ],
          },
          completed: true,
        })
        .expect(200);

      expect(res.body.sectionKey).toBe('TRATAMIENTO');
      expect(res.body.completed).toBe(true);
      const storedData = res.body.data;
      expect(storedData.medicamentosEstructurados ?? []).toHaveLength(0);
      expect(storedData.examenesEstructurados ?? []).toHaveLength(1);
    });

    it('PUT /api/encounters/:id/sections/RESPUESTA_TRATAMIENTO → rejects non-text payloads', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/RESPUESTA_TRATAMIENTO`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            evolucion: { texto: 'Mejoría parcial' },
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/OBSERVACIONES → rejects non-text internal notes', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/OBSERVACIONES`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            notasInternas: ['coordinar control en 48 h'],
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/ANAMNESIS_REMOTA → marks optional section as not applicable', async () => {
      const res = await req()
        .put(`/api/encounters/${encounterId}/sections/ANAMNESIS_REMOTA`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {},
          completed: true,
          notApplicable: true,
          notApplicableReason: 'Paciente pediátrico sin antecedentes remotos relevantes',
        })
        .expect(200);

      expect(res.body.notApplicable).toBe(true);
      expect(res.body.completed).toBe(true);
      expect(res.body.notApplicableReason).toBe('Paciente pediátrico sin antecedentes remotos relevantes');
    });

    it('PUT /api/encounters/:id/sections/MOTIVO_CONSULTA → rejects notApplicable on required section', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/MOTIVO_CONSULTA`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: { texto: 'Cefalea intensa' },
          notApplicable: true,
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections → rejects notApplicable without reason', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/REVISION_SISTEMAS`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {},
          completed: true,
          notApplicable: true,
        })
        .expect(400);
    });

    it('POST /api/encounters/:id/reconcile-identification → refreshes identification from patient master', async () => {
      const res = await req()
        .post(`/api/encounters/${encounterId}/reconcile-identification`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(201);

      expect(res.body.sectionKey).toBe('IDENTIFICACION');
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.nombre).toBe('string');
    });

    it('POST /api/patients/:id/problems → create patient problem', async () => {
      const onsetDate = '2026-03-18';
      const res = await req()
        .post(`/api/patients/${patientId}/problems`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          label: 'Hipertension arterial',
          notes: 'Control pendiente',
          status: 'ACTIVO',
          onsetDate,
          encounterId,
        })
        .expect(201);

      expect(res.body.label).toBe('Hipertension arterial');
      expect(res.body.onsetDate.slice(0, 10)).toBe(onsetDate);
      expect(res.body.medicoId).toBe(medicoUserId);
      patientProblemId = res.body.id;
    });

    it('PUT /api/patients/problems/:problemId → rejects invalid patient problem status', async () => {
      const res = await req()
        .put(`/api/patients/problems/${patientProblemId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          status: 'ESTADO_INVALIDO',
        })
        .expect(400);

      expect(String(res.body.message)).toContain('status');
    });

    it('PUT /api/patients/problems/:problemId → resolve patient problem', async () => {
      const res = await req()
        .put(`/api/patients/problems/${patientProblemId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          status: 'RESUELTO',
        })
        .expect(200);

      expect(res.body.status).toBe('RESUELTO');
    });

    it('POST /api/patients/:id/tasks → create patient task', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await req()
        .post(`/api/patients/${patientId}/tasks`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          title: 'Revisar examen de control',
          details: 'Llamar al paciente cuando llegue resultado',
          type: 'EXAMEN',
          dueDate: today,
          encounterId,
        })
        .expect(201);

      expect(res.body.title).toBe('Revisar examen de control');
      expect(res.body.dueDate.slice(0, 10)).toBe(today);
      expect(res.body.medicoId).toBe(medicoUserId);
      patientTaskId = res.body.id;
    });

    it('GET /api/patients/tasks → list task inbox', async () => {
      const res = await req()
        .get('/api/patients/tasks?search=Revisar')
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.data.some((task: any) => task.id === patientTaskId)).toBe(true);
    });

    it('GET /api/patients/tasks → admin gets 403 because the task inbox is clinical', async () => {
      await req().get('/api/patients/tasks?search=Revisar').set('Cookie', cookieHeader(adminCookies)).expect(403);
    });

    it('GET /api/patients/tasks?overdueOnly=true → does not mark tasks due today as overdue', async () => {
      const res = await req()
        .get('/api/patients/tasks?overdueOnly=true')
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.data.some((task: any) => task.id === patientTaskId)).toBe(false);
    });

    it('PUT /api/patients/tasks/:taskId → update patient task', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const res = await req()
        .put(`/api/patients/tasks/${patientTaskId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          title: 'Revisar examen de control actualizado',
          status: 'EN_PROCESO',
          dueDate: yesterday,
        })
        .expect(200);

      expect(res.body.title).toBe('Revisar examen de control actualizado');
      expect(res.body.status).toBe('EN_PROCESO');
      expect(res.body.dueDate.slice(0, 10)).toBe(yesterday);
    });

    it('GET /api/patients/tasks?overdueOnly=true → includes tasks whose due date already passed', async () => {
      const res = await req()
        .get('/api/patients/tasks?overdueOnly=true')
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      const task = res.body.data.find((item: any) => item.id === patientTaskId);
      expect(task).toBeDefined();
      expect(task.isOverdue).toBe(true);
    });

    it('GET /api/patients/tasks?status=COMPLETADA&overdueOnly=true → keeps filter semantics and returns empty', async () => {
      const res = await req()
        .get('/api/patients/tasks?status=COMPLETADA&overdueOnly=true')
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it('POST /api/attachments/encounter/:id → upload exam result linked to structured order', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      const res = await req()
        .post(`/api/attachments/encounter/${encounterId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .field('category', 'EXAMEN')
        .field('description', 'Resultado recibido por laboratorio')
        .field('linkedOrderType', 'EXAMEN')
        .field('linkedOrderId', 'exam-hemograma')
        .attach('file', pdfBuffer, {
          filename: 'hemograma.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(res.body.originalName).toBe('hemograma.pdf');
      expect(res.body.linkedOrderType).toBe('EXAMEN');
      expect(res.body.linkedOrderId).toBe('exam-hemograma');
      expect(res.body.linkedOrderLabel).toBe('Hemograma completo');
      attachmentId = res.body.id;
    });

    it('GET /api/attachments/encounter/:id → returns linked attachment metadata', async () => {
      const res = await req()
        .get(`/api/attachments/encounter/${encounterId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      const attachment = res.body.find((item: any) => item.id === attachmentId);
      expect(attachment).toBeDefined();
      expect(attachment.linkedOrderType).toBe('EXAMEN');
      expect(attachment.linkedOrderLabel).toBe('Hemograma completo');
    });

    it('GET /api/attachments/:id/download → returns binary file', async () => {
      const res = await req()
        .get(`/api/attachments/${attachmentId}/download`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('hemograma.pdf');
    });

    it('PUT /api/encounters/:id/review-status → rejects review without contextual note', async () => {
      const res = await req()
        .put(`/api/encounters/${encounterId}/review-status`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          reviewStatus: 'REVISADA_POR_MEDICO',
          note: 'corta',
        })
        .expect(400);

      expect(String(res.body.message)).toContain('nota de revisión');
    });

    it('PUT /api/encounters/:id/review-status → update review status with note and traceability', async () => {
      const res = await req()
        .put(`/api/encounters/${encounterId}/review-status`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          reviewStatus: 'REVISADA_POR_MEDICO',
          note: 'Revisión médica realizada con correlación clínico-radiológica.',
        })
        .expect(200);

      expect(res.body.reviewStatus).toBe('REVISADA_POR_MEDICO');
      expect(res.body.reviewNote).toContain('Revisión médica');
      expect(res.body.reviewedBy?.id).toBe(medicoUserId);
    });

    it('GET /api/patients/:id → returns patient detail without embedding the encounter timeline', async () => {
      const res = await req().get(`/api/patients/${patientId}`).set('Cookie', cookieHeader(medicoCookies)).expect(200);

      expect(res.body.encounters).toBeUndefined();
    });

    it('GET /api/patients/:id/encounters → returns a paginated timeline read model with schemaVersion', async () => {
      const res = await req()
        .get(`/api/patients/${patientId}/encounters?page=1&limit=5`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      const encounter = res.body.data.find((item: any) => item.id === encounterId);
      expect(encounter).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination?.page).toBe(1);
      expect(res.body.pagination?.limit).toBe(5);
      expect(res.body.pagination?.total).toBeGreaterThanOrEqual(1);
      expect(encounter.progress?.total).toBe(10);
      expect(encounter.reviewNote).toContain('Revisión médica');
      expect(encounter.reviewedBy?.id).toBe(medicoUserId);
      expect(Array.isArray(encounter.sections)).toBe(true);
      expect(
        encounter.sections.every(
          (section: any) => section.schemaVersion === getEncounterSectionSchemaVersion(section.sectionKey),
        ),
      ).toBe(true);
    });

    it('GET /api/patients/:id/clinical-summary → returns a derived longitudinal read model', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/EXAMEN_FISICO`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            signosVitales: {
              presionArterial: '120/80',
              peso: '70',
              imc: '24.2',
              temperatura: '36.7',
              saturacionOxigeno: '98',
            },
          },
          completed: true,
        })
        .expect(200);

      await req()
        .put(`/api/encounters/${encounterId}/sections/SOSPECHA_DIAGNOSTICA`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            sospechas: [{ id: 'dx-1', diagnostico: 'Migraña', notas: 'probable' }],
          },
          completed: true,
        })
        .expect(200);

      await req()
        .put(`/api/encounters/${encounterId}/sections/OBSERVACIONES`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            resumenClinico: 'Paciente con buena respuesta inicial.',
          },
        })
        .expect(200);

      const res = await req()
        .get(`/api/patients/${patientId}/clinical-summary`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.patientId).toBe(patientId);
      expect(res.body.counts.totalEncounters).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.vitalTrend)).toBe(true);
      expect(res.body.vitalTrend[0]?.peso).toBe(70);
      expect(res.body.recentDiagnoses).toEqual(
        expect.arrayContaining([expect.objectContaining({ label: 'Migraña', count: 1 })]),
      );
      expect(res.body.latestEncounterSummary?.lines).toEqual(
        expect.arrayContaining([expect.stringContaining('Resumen: Paciente con buena respuesta inicial.')]),
      );
    });

    it('GET /api/encounters?reviewStatus=REVISADA_POR_MEDICO → filter encounters by review status', async () => {
      const res = await req()
        .get('/api/encounters?reviewStatus=REVISADA_POR_MEDICO')
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.data.some((item: any) => item.id === encounterId)).toBe(true);
    });

    it('POST /api/patients/quick → create blocked patient for output-policy coverage', async () => {
      const res = await req()
        .post('/api/patients/quick')
        .set('Cookie', cookieHeader(assistantCookies))
        .send({
          nombre: 'Paciente Bloqueado',
          rutExempt: true,
          rutExemptReason: 'Paciente sin documento disponible',
        })
        .expect(201);

      blockedPatientId = res.body.id;
      expect(res.body.completenessStatus).toBe('INCOMPLETA');
    });

    it('POST /api/encounters/patient/:patientId → create encounter for output-policy coverage', async () => {
      const res = await req()
        .post(`/api/encounters/patient/${blockedPatientId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({})
        .expect(201);

      blockedEncounterId = res.body.id;
      expect(blockedEncounterId).toBeDefined();
    });

    it('POST /api/consents → 400 when encounterId does not belong to patientId', async () => {
      const res = await req()
        .post('/api/consents')
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          patientId,
          encounterId: blockedEncounterId,
          type: 'TRATAMIENTO',
          description: 'Consentimiento inválido para validar asociación paciente-atención.',
        })
        .expect(400);

      expect(String(res.body.message)).toContain('no corresponde al paciente');
    });

    it('POST /api/alerts → 400 when encounterId does not belong to patientId', async () => {
      const res = await req()
        .post('/api/alerts')
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          patientId,
          encounterId: blockedEncounterId,
          type: 'GENERAL',
          severity: 'MEDIA',
          title: 'Asociación inválida',
          message: 'La atención no corresponde al paciente indicado.',
        })
        .expect(400);

      expect(String(res.body.message)).toContain('no corresponde al paciente');
    });

    it('GET /api/encounters/:id/export/pdf → 400 while patient record remains incomplete', async () => {
      const res = await req()
        .get(`/api/encounters/${blockedEncounterId}/export/pdf`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(400);

      expect(String(res.body.message)).toContain('ficha maestra del paciente sigue incompleta');
    });

    it('POST /api/encounters/:id/complete → 400 while patient record remains incomplete', async () => {
      const res = await req()
        .post(`/api/encounters/${blockedEncounterId}/complete`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({ closureNote: 'Cierre suficientemente largo para la validación base.' })
        .expect(400);

      expect(String(res.body.message)).toContain('ficha maestra del paciente sigue incompleta');
    });

    it('PUT /api/patients/:id/admin → move blocked patient to pending verification', async () => {
      const res = await req()
        .put(`/api/patients/${blockedPatientId}/admin`)
        .set('Cookie', cookieHeader(assistantCookies))
        .send({
          edad: 31,
          sexo: 'FEMENINO',
          prevision: 'FONASA',
          trabajo: 'Recepcionista',
        })
        .expect(200);

      expect(res.body.completenessStatus).toBe('PENDIENTE_VERIFICACION');
    });

    it('GET /api/encounters/:id/export/document/receta → 400 while patient record is pending verification', async () => {
      const res = await req()
        .get(`/api/encounters/${blockedEncounterId}/export/document/receta`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(400);

      expect(String(res.body.message)).toContain('pendiente de verificación médica');
    });

    it('GET /api/encounters/:id/export/document/receta → returns PDF', async () => {
      const res = await req()
        .get(`/api/encounters/${encounterId}/export/document/receta`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('GET /api/encounters/:id/export/document/ordenes → returns PDF', async () => {
      const res = await req()
        .get(`/api/encounters/${encounterId}/export/document/ordenes`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('GET /api/encounters/:id/export/document/derivacion → returns PDF', async () => {
      const res = await req()
        .get(`/api/encounters/${encounterId}/export/document/derivacion`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('DELETE /api/attachments/:id → medico can delete attachment', async () => {
      const res = await req()
        .delete(`/api/attachments/${attachmentId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.message).toContain('eliminado');
    });

    it('POST /api/encounters/:id/complete → 400 when required sections are missing', async () => {
      const res = await req()
        .post(`/api/encounters/${encounterId}/complete`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(400);

      expect(String(res.body.message)).toContain('secciones obligatorias');
    });

    it('PUT /api/encounters/:id/sections/INVALID → 400', async () => {
      await req()
        .put(`/api/encounters/${encounterId}/sections/INVALID_KEY`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({ data: { foo: 'bar' } })
        .expect(400);
    });

    it('POST /api/encounters/:id/cancel → cancel encounter', async () => {
      const res = await req()
        .post(`/api/encounters/${encounterId}/cancel`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(201);

      expect(res.body.status).toBe('CANCELADO');
    });

    it('POST /api/encounters/patient/:patientId → create workflow encounter for complete/reopen coverage', async () => {
      const res = await req()
        .post(`/api/encounters/patient/${patientId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({})
        .expect(201);

      workflowEncounterId = res.body.id;
      expect(workflowEncounterId).toBeDefined();
    });

    it('PUT /api/encounters/:id/sections/IDENTIFICACION → marks identification snapshot complete for workflow encounter', async () => {
      const encounterRes = await req()
        .get(`/api/encounters/${workflowEncounterId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      const identification = encounterRes.body.sections.find((section: any) => section.sectionKey === 'IDENTIFICACION');

      const res = await req()
        .put(`/api/encounters/${workflowEncounterId}/sections/IDENTIFICACION`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: identification.data,
          completed: true,
        })
        .expect(200);

      expect(res.body.completed).toBe(true);
    });

    it('PUT /api/encounters/:id/sections/MOTIVO_CONSULTA → prepares workflow encounter for completion', async () => {
      await req()
        .put(`/api/encounters/${workflowEncounterId}/sections/MOTIVO_CONSULTA`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: { texto: 'Dolor abdominal de 24 horas de evolución' },
          completed: true,
        })
        .expect(200);

      await req()
        .put(`/api/encounters/${workflowEncounterId}/sections/EXAMEN_FISICO`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            abdomen: 'Abdomen blando, depresible, doloroso en fosa iliaca derecha.',
          },
          completed: true,
        })
        .expect(200);

      await req()
        .put(`/api/encounters/${workflowEncounterId}/sections/SOSPECHA_DIAGNOSTICA`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            sospechas: [
              {
                id: 'dx-apendicitis',
                diagnostico: 'Apendicitis aguda',
                notas: 'Correlacionar con clínica y exámenes.',
              },
            ],
          },
          completed: true,
        })
        .expect(200);

      const treatmentRes = await req()
        .put(`/api/encounters/${workflowEncounterId}/sections/TRATAMIENTO`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          data: {
            plan: 'Solicitar evaluación quirúrgica y laboratorio urgente.',
          },
          completed: true,
        })
        .expect(200);

      expect(treatmentRes.body.completed).toBe(true);
    });

    it('POST /api/encounters/:id/complete → rejects completion without closure note once sections are ready', async () => {
      const res = await req()
        .post(`/api/encounters/${workflowEncounterId}/complete`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          closureNote: 'corta',
        })
        .expect(400);

      expect(String(res.body.message)).toContain('nota de cierre');
    });

    it('PUT /api/encounters/:id/review-status → stores workflow review note before completion', async () => {
      const res = await req()
        .put(`/api/encounters/${workflowEncounterId}/review-status`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          reviewStatus: 'REVISADA_POR_MEDICO',
          note: 'Revisión final con hallazgos concordantes y autorización de cierre.',
        })
        .expect(200);

      expect(res.body.reviewStatus).toBe('REVISADA_POR_MEDICO');
      expect(res.body.reviewNote).toContain('autorización de cierre');
    });

    it('POST /api/encounters/:id/complete → completes encounter with closure traceability', async () => {
      const res = await req()
        .post(`/api/encounters/${workflowEncounterId}/complete`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          closureNote: 'Paciente derivado con sospecha confirmada y plan quirúrgico informado.',
        })
        .expect(201);

      expect(res.body.status).toBe('COMPLETADO');
      expect(res.body.reviewStatus).toBe('REVISADA_POR_MEDICO');
      expect(res.body.reviewNote).toContain('autorización de cierre');
      expect(res.body.closureNote).toContain('plan quirúrgico');
      expect(res.body.completedBy?.id).toBe(medicoUserId);
    });

    it('POST /api/encounters/:id/complete → rejects double-complete on already completed encounter', async () => {
      await req()
        .post(`/api/encounters/${workflowEncounterId}/complete`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          closureNote: 'Intento duplicado de cierre.',
        })
        .expect(400);
    });

    it('POST /api/encounters/:id/reopen → admin gets 403 because reopening is clinical', async () => {
      await req()
        .post(`/api/encounters/${workflowEncounterId}/reopen`)
        .set('Cookie', cookieHeader(adminCookies))
        .send({
          note: 'Se intenta reabrir sin rol clínico.',
        })
        .expect(403);
    });

    it('POST /api/encounters/:id/reopen → medico requires reopen note', async () => {
      const res = await req()
        .post(`/api/encounters/${workflowEncounterId}/reopen`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          note: 'corta',
        })
        .expect(400);

      expect(String(res.body.message)).toContain('note');
    });

    it('POST /api/encounters/:id/reopen → medico reopens own encounter with explicit trace note', async () => {
      const res = await req()
        .post(`/api/encounters/${workflowEncounterId}/reopen`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          note: 'Se reabre por auditoría clínica para complementar evolución.',
        })
        .expect(201);

      expect(res.body.status).toBe('EN_PROGRESO');
      expect(res.body.reviewStatus).toBe('NO_REQUIERE_REVISION');
      expect(res.body.closureNote).toBeNull();
      expect(res.body.completedAt).toBeNull();
    });
  });

  // ── 10. Admin: Users Management ─────────────────────────────────────

  describe('Admin - Users', () => {
    // Re-login admin to get fresh cookies
    beforeAll(async () => {
      const res = await req().post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin123' });
      adminCookies = extractCookies(res);
    });

    it('GET /api/users → admin can list users', async () => {
      const res = await req().get('/api/users').set('Cookie', cookieHeader(adminCookies)).expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('POST /api/users/:id/reset-password → rejects spaces in temporary password', async () => {
      await req()
        .post(`/api/users/${medicoUserId}/reset-password`)
        .send({ temporaryPassword: 'Nueva Clave123' })
        .set('Cookie', cookieHeader(adminCookies))
        .expect(400);
    });

    it('POST /api/users/:id/reset-password → admin can reset password with dot', async () => {
      const res = await req()
        .post(`/api/users/${medicoUserId}/reset-password`)
        .send({ temporaryPassword: 'Nueva.Clave123' })
        .set('Cookie', cookieHeader(adminCookies))
        .expect(201);

      expect(res.body.message).toBe('Contraseña restablecida correctamente');
    });

    it('GET /api/users → non-admin gets 403', async () => {
      await req().get('/api/users').set('Cookie', cookieHeader(medicoCookies)).expect(403);
    });

    it('GET /api/settings → admin can read settings', async () => {
      const res = await req().get('/api/settings').set('Cookie', cookieHeader(adminCookies)).expect(200);

      expect(res.body['smtp.password']).toBeUndefined();
      expect(res.body['smtp.passwordConfigured']).toBe('false');
    });

    it('PUT /api/settings → admin can save invitation html template', async () => {
      const template =
        '<html><body><img src="{{logoUrl}}" alt="{{clinicName}}" /><a href="{{inviteUrl}}">Entrar</a></body></html>';
      const res = await req()
        .put('/api/settings')
        .set('Cookie', cookieHeader(adminCookies))
        .send({
          smtpPassword: 'SMTP.SuperSecret123',
          invitationTemplateHtml: template,
          invitationSubject: 'Invitacion {{roleLabel}} - {{clinicName}}',
        })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);

      const settingsRes = await req().get('/api/settings').set('Cookie', cookieHeader(adminCookies)).expect(200);

      expect(settingsRes.body['smtp.password']).toBeUndefined();
      expect(settingsRes.body['smtp.passwordConfigured']).toBe('true');
      expect(settingsRes.body['email.invitationTemplateHtml']).toBe(template);
      expect(settingsRes.body['email.invitationSubject']).toBe('Invitacion {{roleLabel}} - {{clinicName}}');

      const persistedSmtpPassword = await prisma.setting.findUnique({
        where: { key: 'smtp.password' },
      });

      expect(persistedSmtpPassword?.value).toBeDefined();
      expect(persistedSmtpPassword?.value).not.toBe('SMTP.SuperSecret123');
      expect(persistedSmtpPassword?.value.startsWith('enc:v1:')).toBe(true);
    });

    it('POST /api/mail/test-invitation → admin gets diagnostic response when smtp is missing', async () => {
      const res = await req()
        .post('/api/mail/test-invitation')
        .set('Cookie', cookieHeader(adminCookies))
        .send({
          email: 'admin@test.com',
          clinicName: 'Anamneo Test',
          appPublicUrl: 'http://localhost:5555',
          invitationSubject: 'Prueba {{clinicName}}',
        })
        .expect(201);

      expect(res.body.sent).toBe(false);
      expect(String(res.body.reason)).toContain('SMTP');
    });

    it('GET /api/settings → non-admin gets 403', async () => {
      await req().get('/api/settings').set('Cookie', cookieHeader(medicoCookies)).expect(403);
    });
  });

  describe('Admin - Audit', () => {
    it('GET /api/patients/export/csv → admin can export patient registry', async () => {
      const res = await req()
        .get('/api/patients/export/csv')
        .set('x-request-id', 'audit-export-request')
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['x-request-id']).toBe('audit-export-request');
      expect(String(res.text)).toContain('Nombre,RUT,Edad');
    });

    it('GET /api/audit → admin can filter same-day logs with inclusive dateTo', async () => {
      const today = new Date().toISOString().slice(0, 10);

      const res = await req()
        .get('/api/audit')
        .query({ page: 1, limit: 30, dateFrom: today, dateTo: today })
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.pagination?.page).toBe(1);
    });

    it('GET /api/audit?action=EXPORT&entityType=Encounter → returns encounter export logs', async () => {
      const res = await req()
        .get('/api/audit')
        .query({ action: 'EXPORT', entityType: 'Encounter', page: 1, limit: 30 })
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(res.body.data.some((item: any) => item.entityId === encounterId)).toBe(true);
    });

    it('GET /api/audit?action=DOWNLOAD&entityType=Attachment → returns attachment download logs', async () => {
      const res = await req()
        .get('/api/audit')
        .query({ action: 'DOWNLOAD', entityType: 'Attachment', page: 1, limit: 30 })
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(res.body.data.some((item: any) => item.entityId === attachmentId)).toBe(true);
    });

    it('GET /api/audit?action=EXPORT&entityType=PatientExport → returns CSV export logs', async () => {
      const res = await req()
        .get('/api/audit')
        .query({ action: 'EXPORT', entityType: 'PatientExport', requestId: 'audit-export-request', page: 1, limit: 30 })
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(res.body.data.some((item: any) => item.entityId === 'csv')).toBe(true);
      expect(res.body.data.every((item: any) => item.requestId?.includes('audit-export-request'))).toBe(true);
    });

    it('GET /api/audit?reason=PATIENT_EXPORT_CSV&result=SUCCESS → filters by audit catalog semantics', async () => {
      const res = await req()
        .get('/api/audit')
        .query({ reason: 'PATIENT_EXPORT_CSV', result: 'SUCCESS', entityType: 'PatientExport', page: 1, limit: 30 })
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((item: any) => item.reason === 'PATIENT_EXPORT_CSV')).toBe(true);
      expect(res.body.data.every((item: any) => item.result === 'SUCCESS')).toBe(true);
    });

    it('GET /api/audit?action=PASSWORD_CHANGED&entityType=User → returns admin password reset logs', async () => {
      const res = await req()
        .get('/api/audit')
        .query({ action: 'PASSWORD_CHANGED', entityType: 'User', page: 1, limit: 30 })
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(res.body.data.some((item: any) => item.entityId === medicoUserId)).toBe(true);
    });

    it('GET /api/audit?entityType=UserInvitation → returns invitation lifecycle logs', async () => {
      const res = await req()
        .get('/api/audit')
        .query({ entityType: 'UserInvitation', page: 1, limit: 30 })
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      const invitationActions = res.body.data.map((item: any) => item.action);
      expect(invitationActions).toContain('CREATE');
      expect(invitationActions).toContain('UPDATE');
    });

    it('GET /api/audit → non-admin gets 403', async () => {
      await req().get('/api/audit').set('Cookie', cookieHeader(medicoCookies)).expect(403);
    });
  });

  // ── 11. Auth: Refresh (cookie-based) ────────────────────────────────

  describe('Auth - Refresh', () => {
    it('POST /api/auth/refresh → refreshes tokens via cookie', async () => {
      // Login to get fresh cookies
      const loginRes = await req()
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Admin123' })
        .expect(200);

      const freshCookies = extractCookies(loginRes);
      expect(freshCookies.length).toBeGreaterThanOrEqual(2);

      // Verify refresh_token cookie exists
      const hasRefreshCookie = freshCookies.some((c) => c.startsWith('refresh_token='));
      expect(hasRefreshCookie).toBe(true);

      const res = await req().post('/api/auth/refresh').set('Cookie', cookieHeader(freshCookies)).expect(200);

      expect(res.body.message).toBe('Tokens actualizados');
      const newCookies = extractCookies(res);
      expect(newCookies.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── 12. Validation ──────────────────────────────────────────────────

  describe('Validation', () => {
    it('POST /api/auth/register → invalid email', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'Valid123', nombre: 'Test' })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('POST /api/auth/register → weak password', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({ email: 'weak@test.com', password: '12345678', nombre: 'Test' })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('POST /api/auth/register → rejects public registration with valid password but no invitation', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({ email: 'dotpass@test.com', password: 'Dot.Pass123', nombre: 'Dot Test', role: 'MEDICO' })
        .expect(403);

      expect(String(res.body.message)).toContain('invitación');
    });

    it('POST /api/auth/register → rejects password with spaces', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({ email: 'spacepass@test.com', password: 'Space Pass123', nombre: 'Space Test', role: 'MEDICO' })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('POST /api/patients → missing required fields', async () => {
      await req().post('/api/patients').set('Cookie', cookieHeader(medicoCookies)).send({ nombre: 'Test' }).expect(400);
    });
  });

  // ── 13. Patient Data Isolation (IDOR Prevention) ────────────────────

  describe('Patient Data Isolation', () => {
    let medico2Cookies: string[] = [];
    let medico2UserId: string;
    let medico2PatientId: string;
    let medico2InvitationToken: string;
    let leakedEncounterId: string;
    let leakedProblemId: string;
    let leakedTaskId: string;
    let leakedStandaloneProblemId: string;
    let leakedStandaloneTaskId: string;
    let leakedConsentId: string;
    let leakedAlertId: string;

    it('Admin invites a second medico', async () => {
      const res = await req()
        .post('/api/users/invitations')
        .set('Cookie', cookieHeader(adminCookies))
        .send({
          email: 'medico2@test.com',
          role: 'MEDICO',
        })
        .expect(201);

      medico2InvitationToken = res.body.token;
      expect(medico2InvitationToken).toBeDefined();
    });

    it('Register a second medico with invitation', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({
          email: 'medico2@test.com',
          password: 'Medico2x1',
          nombre: 'Dr. Segundo',
          role: 'MEDICO',
          invitationToken: medico2InvitationToken,
        })
        .expect(201);

      medico2Cookies = extractCookies(res);
      const medico2User = await prisma.user.findUniqueOrThrow({
        where: { email: 'medico2@test.com' },
        select: { id: true },
      });
      medico2UserId = medico2User.id;
      expect(medico2Cookies.length).toBeGreaterThanOrEqual(2);
    });

    it('Second medico creates own patient', async () => {
      const res = await req()
        .post('/api/patients')
        .set('Cookie', cookieHeader(medico2Cookies))
        .send({
          nombre: 'Paciente Medico2',
          edad: 40,
          sexo: 'FEMENINO',
          prevision: 'ISAPRE',
        })
        .expect(201);

      medico2PatientId = res.body.id;
      expect(medico2PatientId).toBeDefined();
    });

    it('Second medico cannot see first medico patients in list', async () => {
      const res = await req().get('/api/patients').set('Cookie', cookieHeader(medico2Cookies)).expect(200);

      const ids = res.body.data.map((p: any) => p.id);
      expect(ids).not.toContain(patientId);
      expect(ids).toContain(medico2PatientId);
    });

    it('First medico cannot see second medico patients in list', async () => {
      const res = await req().get('/api/patients').set('Cookie', cookieHeader(medicoCookies)).expect(200);

      const ids = res.body.data.map((p: any) => p.id);
      expect(ids).toContain(patientId);
      expect(ids).not.toContain(medico2PatientId);
    });

    it('Second medico cannot access first medico patient by ID', async () => {
      await req().get(`/api/patients/${patientId}`).set('Cookie', cookieHeader(medico2Cookies)).expect(404);
    });

    it('First medico cannot access second medico patient by ID', async () => {
      await req().get(`/api/patients/${medico2PatientId}`).set('Cookie', cookieHeader(medicoCookies)).expect(404);
    });

    it('Second medico cannot create encounters for a patient outside their scope', async () => {
      await req()
        .post(`/api/encounters/patient/${patientId}`)
        .set('Cookie', cookieHeader(medico2Cookies))
        .send({})
        .expect(404);
    });

    it('Patient timeline and derived summary do not leak encounters from another medico scope', async () => {
      const leakedEncounter = await prisma.encounter.create({
        data: {
          patientId,
          medicoId: medico2UserId,
          createdById: medico2UserId,
          status: 'COMPLETADO',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
        },
      });
      leakedEncounterId = leakedEncounter.id;

      const timelineRes = await req()
        .get(`/api/patients/${patientId}/encounters?page=1&limit=10`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(timelineRes.body.data.some((item: any) => item.id === leakedEncounterId)).toBe(false);

      const summaryRes = await req()
        .get(`/api/patients/${patientId}/clinical-summary`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(summaryRes.body.latestEncounterSummary?.encounterId).not.toBe(leakedEncounterId);
      expect(summaryRes.body.counts.totalEncounters).toBe(2);
    });

    it('First medico still gets 404 when trying to open another medico encounter directly', async () => {
      await req().get(`/api/encounters/${leakedEncounterId}`).set('Cookie', cookieHeader(medicoCookies)).expect(404);
    });

    it('Patient detail, encounter detail, summary and task inbox do not leak problems or tasks from another medico scope', async () => {
      const [linkedProblem, linkedTask, standaloneProblem, standaloneTask] = await prisma.$transaction([
        prisma.patientProblem.create({
          data: {
            patientId,
            encounterId: leakedEncounterId,
            createdById: medico2UserId,
            label: 'Problema filtrado',
            status: 'ACTIVO',
          },
        }),
        prisma.encounterTask.create({
          data: {
            patientId,
            encounterId: leakedEncounterId,
            createdById: medico2UserId,
            title: 'Seguimiento filtrado',
            status: 'PENDIENTE',
          },
        }),
        prisma.patientProblem.create({
          data: {
            patientId,
            createdById: medico2UserId,
            label: 'Problema standalone filtrado',
            status: 'ACTIVO',
          },
        }),
        prisma.encounterTask.create({
          data: {
            patientId,
            createdById: medico2UserId,
            title: 'Seguimiento standalone filtrado',
            status: 'PENDIENTE',
          },
        }),
      ]);

      leakedProblemId = linkedProblem.id;
      leakedTaskId = linkedTask.id;
      leakedStandaloneProblemId = standaloneProblem.id;
      leakedStandaloneTaskId = standaloneTask.id;

      const patientRes = await req()
        .get(`/api/patients/${patientId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);
      expect(patientRes.body.problems.map((item: any) => item.id)).toContain(patientProblemId);
      expect(patientRes.body.problems.map((item: any) => item.id)).not.toEqual(
        expect.arrayContaining([leakedProblemId, leakedStandaloneProblemId]),
      );
      expect(patientRes.body.tasks.map((item: any) => item.id)).toContain(patientTaskId);
      expect(patientRes.body.tasks.map((item: any) => item.id)).not.toEqual(
        expect.arrayContaining([leakedTaskId, leakedStandaloneTaskId]),
      );

      const encounterRes = await req()
        .get(`/api/encounters/${encounterId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);
      expect(encounterRes.body.patient.problems.map((item: any) => item.id)).not.toEqual(
        expect.arrayContaining([leakedProblemId, leakedStandaloneProblemId]),
      );
      expect(encounterRes.body.patient.tasks.map((item: any) => item.id)).not.toEqual(
        expect.arrayContaining([leakedTaskId, leakedStandaloneTaskId]),
      );

      const summaryRes = await req()
        .get(`/api/patients/${patientId}/clinical-summary`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);
      expect(summaryRes.body.activeProblems.map((item: any) => item.id)).not.toEqual(
        expect.arrayContaining([leakedProblemId, leakedStandaloneProblemId]),
      );
      expect(summaryRes.body.pendingTasks.map((item: any) => item.id)).not.toEqual(
        expect.arrayContaining([leakedTaskId, leakedStandaloneTaskId]),
      );

      const inboxRes = await req().get('/api/patients/tasks').set('Cookie', cookieHeader(medicoCookies)).expect(200);
      expect(inboxRes.body.data.map((item: any) => item.id)).not.toEqual(
        expect.arrayContaining([leakedTaskId, leakedStandaloneTaskId]),
      );
    });

    it('First medico cannot attach new problems or tasks to another medico encounter on the same patient', async () => {
      await req()
        .post(`/api/patients/${patientId}/problems`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          label: 'No debe vincularse',
          encounterId: leakedEncounterId,
        })
        .expect(400);

      await req()
        .post(`/api/patients/${patientId}/tasks`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          title: 'No debe vincularse',
          encounterId: leakedEncounterId,
        })
        .expect(400);
    });

    it('First medico cannot update another medico problem or task even if the patient is otherwise visible', async () => {
      await req()
        .put(`/api/patients/problems/${leakedStandaloneProblemId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          notes: 'Intento fuera de scope',
        })
        .expect(404);

      await req()
        .put(`/api/patients/tasks/${leakedStandaloneTaskId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          status: 'COMPLETADA',
        })
        .expect(404);
    });

    it('Encounter-linked consents and alerts do not leak across medicos sharing the same patient', async () => {
      const [consent, alert] = await prisma.$transaction([
        prisma.informedConsent.create({
          data: {
            patientId,
            encounterId: leakedEncounterId,
            type: 'PROCEDIMIENTO',
            description: 'Consentimiento del encuentro filtrado',
            grantedById: medico2UserId,
          },
        }),
        prisma.clinicalAlert.create({
          data: {
            patientId,
            encounterId: leakedEncounterId,
            type: 'GENERAL',
            severity: 'ALTA',
            title: 'Alerta del encuentro filtrado',
            message: 'No deberia verse desde otro medico',
            createdById: medico2UserId,
          },
        }),
      ]);

      leakedConsentId = consent.id;
      leakedAlertId = alert.id;

      const consentsRes = await req()
        .get(`/api/consents/patient/${patientId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(consentsRes.body.map((item: any) => item.id)).not.toContain(leakedConsentId);

      const alertsRes = await req()
        .get(`/api/alerts/patient/${patientId}?includeAcknowledged=true`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(alertsRes.body.map((item: any) => item.id)).not.toContain(leakedAlertId);

      await req()
        .post(`/api/consents/${leakedConsentId}/revoke`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({ reason: 'Intento fuera de scope' })
        .expect(404);

      await req()
        .post(`/api/alerts/${leakedAlertId}/acknowledge`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({})
        .expect(404);

      const medico2ConsentsRes = await req()
        .get(`/api/consents/patient/${patientId}`)
        .set('Cookie', cookieHeader(medico2Cookies))
        .expect(200);

      expect(medico2ConsentsRes.body.map((item: any) => item.id)).toContain(leakedConsentId);

      const medico2AlertsRes = await req()
        .get(`/api/alerts/patient/${patientId}?includeAcknowledged=true`)
        .set('Cookie', cookieHeader(medico2Cookies))
        .expect(200);

      expect(medico2AlertsRes.body.map((item: any) => item.id)).toContain(leakedAlertId);
    });

    it('First medico cannot update second medico patient history or admin fields', async () => {
      await req()
        .put(`/api/patients/${medico2PatientId}/history`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          antecedentesMedicos: {
            texto: 'Intento fuera de alcance',
          },
        })
        .expect(404);

      await req()
        .put(`/api/patients/${medico2PatientId}/admin`)
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          domicilio: 'No debería persistirse',
        })
        .expect(404);
    });

    it('Admin can see all patients', async () => {
      const res = await req().get('/api/patients').set('Cookie', cookieHeader(adminCookies)).expect(200);

      const ids = res.body.data.map((p: any) => p.id);
      expect(ids).toContain(patientId);
      expect(ids).toContain(medico2PatientId);
    });
  });

  describe('Patient Timeline Volume', () => {
    it('GET /api/patients/:id/encounters → keeps pagination metadata and payload bounded with many encounters', async () => {
      const patientRes = await req()
        .post('/api/patients')
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          nombre: 'Paciente Volumen',
          edad: 52,
          sexo: 'MASCULINO',
          prevision: 'FONASA',
        })
        .expect(201);

      const volumePatientId = patientRes.body.id;
      const baseDate = new Date('2026-04-01T08:00:00.000Z');

      for (let index = 0; index < 14; index += 1) {
        const encounterDate = new Date(baseDate.getTime() + index * 24 * 60 * 60 * 1000);

        await prisma.encounter.create({
          data: {
            patientId: volumePatientId,
            medicoId: medicoUserId,
            createdById: medicoUserId,
            status: 'COMPLETADO',
            reviewStatus: 'REVISADA_POR_MEDICO',
            createdAt: encounterDate,
            updatedAt: encounterDate,
            completedAt: encounterDate,
            sections: {
              create: ENCOUNTER_SECTION_ORDER.map((sectionKey, sectionIndex) => ({
                sectionKey,
                data: JSON.stringify(
                  sectionKey === 'MOTIVO_CONSULTA'
                    ? { texto: `Control ${index + 1}` }
                    : sectionKey === 'OBSERVACIONES'
                      ? {
                          observaciones: `Nota ${index + 1}`,
                          resumenClinico: `Resumen ${index + 1}`,
                        }
                      : sectionKey === 'EXAMEN_FISICO'
                        ? {
                            signosVitales: {
                              peso: String(70 + index),
                              temperatura: '36.5',
                            },
                          }
                        : {},
                ),
                schemaVersion: getEncounterSectionSchemaVersion(sectionKey),
                completed: sectionIndex < 8,
                updatedAt: encounterDate,
              })),
            },
          },
        });
      }

      const res = await req()
        .get(`/api/patients/${volumePatientId}/encounters?page=2&limit=5`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      const payloadSummary = {
        page: res.body.pagination?.page,
        limit: res.body.pagination?.limit,
        total: res.body.pagination?.total,
        totalPages: res.body.pagination?.totalPages,
        itemCount: res.body.data.length,
        firstItemSectionKeys: res.body.data[0]?.sections?.map((section: any) => section.sectionKey),
        firstItemProgress: res.body.data[0]?.progress,
        payloadBytes: Buffer.byteLength(JSON.stringify(res.body)),
      };

      expect(payloadSummary).toMatchInlineSnapshot(`
        {
          "firstItemProgress": {
            "completed": 8,
            "total": 10,
          },
          "firstItemSectionKeys": [
            "IDENTIFICACION",
            "MOTIVO_CONSULTA",
            "ANAMNESIS_PROXIMA",
            "ANAMNESIS_REMOTA",
            "REVISION_SISTEMAS",
            "EXAMEN_FISICO",
            "SOSPECHA_DIAGNOSTICA",
            "TRATAMIENTO",
            "RESPUESTA_TRATAMIENTO",
            "OBSERVACIONES",
          ],
          "itemCount": 5,
          "limit": 5,
          "page": 2,
          "payloadBytes": 16595,
          "total": 14,
          "totalPages": 3,
        }
      `);
      expect(payloadSummary.payloadBytes).toBeLessThan(20000);
    });
  });
});
