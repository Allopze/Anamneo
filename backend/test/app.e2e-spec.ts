import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../src/prisma/prisma.module';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { PatientsModule } from '../src/patients/patients.module';
import { EncountersModule } from '../src/encounters/encounters.module';
import { ConditionsModule } from '../src/conditions/conditions.module';
import { AttachmentsModule } from '../src/attachments/attachments.module';
import { AuditModule } from '../src/audit/audit.module';
import { HealthController } from '../src/health.controller';

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
  let testDatabaseFilePath: string | null = null;

  // Stored IDs used across tests
  let adminUserId: string;
  let medicoUserId: string;
  let patientId: string;
  let encounterId: string;

  // Cookie jars for different users
  let adminCookies: string[] = [];
  let medicoCookies: string[] = [];

  beforeAll(async () => {
    const testDatabaseUrl = resolveBaseTestDatabaseUrl();
    testDatabaseFilePath = resolveSqliteFilePath(testDatabaseUrl);

    if (testDatabaseFilePath && fs.existsSync(testDatabaseFilePath)) {
      fs.rmSync(testDatabaseFilePath, { force: true });
    }

    // Set env vars for test
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.JWT_SECRET = 'test-jwt-secret-key';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    process.env.NODE_ENV = 'test';

    execSync('npx prisma generate', {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'pipe',
    });

    // Push schema to test DB
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
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
        AuditModule,
      ],
      controllers: [HealthController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
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
          role: 'MEDICO',
        })
        .expect(201);

      expect(res.body.message).toBe('Registro exitoso');
      adminCookies = extractCookies(res);
      expect(adminCookies.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/auth/me → returns admin user', async () => {
      const res = await req()
        .get('/api/auth/me')
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(res.body.email).toBe('admin@test.com');
      expect(res.body.isAdmin).toBe(true);
      adminUserId = res.body.id;
    });
  });

  // ── 4. Auth: Register a Medico ──────────────────────────────────────

  describe('Auth - Register Medico', () => {
    it('POST /api/auth/register → medico user', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({
          email: 'medico@test.com',
          password: 'Medico123',
          nombre: 'Dr. Test',
          role: 'MEDICO',
        })
        .expect(201);

      medicoCookies = extractCookies(res);
    });

    it('GET /api/auth/me → returns medico user', async () => {
      const res = await req()
        .get('/api/auth/me')
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.email).toBe('medico@test.com');
      expect(res.body.role).toBe('MEDICO');
      medicoUserId = res.body.id;
    });
  });

  // ── 5. Auth: Login ──────────────────────────────────────────────────

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
      await req()
        .post('/api/auth/login')
        .send({ email: 'medico@test.com', password: 'WrongPass1' })
        .expect(401);
    });
  });

  // ── 6. Auth: Profile & Password ─────────────────────────────────────

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

    it('POST /api/auth/change-password → success', async () => {
      const res = await req()
        .post('/api/auth/change-password')
        .set('Cookie', cookieHeader(medicoCookies))
        .send({ currentPassword: 'Medico123', newPassword: 'NewPass123' })
        .expect(200);

      expect(res.body.message).toBe('Contraseña actualizada correctamente');
    });

    it('POST /api/auth/login → works with new password', async () => {
      const res = await req()
        .post('/api/auth/login')
        .send({ email: 'medico@test.com', password: 'NewPass123' })
        .expect(200);

      medicoCookies = extractCookies(res);
    });
  });

  // ── 7. Auth: Logout ─────────────────────────────────────────────────

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
        .send({ email: 'medico@test.com', password: 'NewPass123' })
        .expect(200);

      medicoCookies = extractCookies(res);
    });
  });

  // ── 8. Patients CRUD ────────────────────────────────────────────────

  describe('Patients', () => {
    it('POST /api/patients → create patient', async () => {
      const res = await req()
        .post('/api/patients')
        .set('Cookie', cookieHeader(medicoCookies))
        .send({
          nombre: 'Paciente Test',
          edad: 35,
          sexo: 'MASCULINO',
          prevision: 'FONASA',
          trabajo: 'Ingeniero',
          domicilio: 'Santiago',
        })
        .expect(201);

      expect(res.body.nombre).toBe('Paciente Test');
      expect(res.body.id).toBeDefined();
      patientId = res.body.id;
    });

    it('GET /api/patients → list patients', async () => {
      const res = await req()
        .get('/api/patients')
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/patients/:id → get patient', async () => {
      const res = await req()
        .get(`/api/patients/${patientId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

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

    it('GET /api/patients?search=Actualizado → search works', async () => {
      const res = await req()
        .get('/api/patients?search=Actualizado')
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.data.length).toBe(1);
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

    it('GET /api/encounters → list encounters', async () => {
      const res = await req()
        .get('/api/encounters')
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/encounters/:id → get encounter with sections', async () => {
      const res = await req()
        .get(`/api/encounters/${encounterId}`)
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(200);

      expect(res.body.id).toBe(encounterId);
      expect(res.body.sections).toBeDefined();
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
  });

  // ── 10. Admin: Users Management ─────────────────────────────────────

  describe('Admin - Users', () => {
    // Re-login admin to get fresh cookies
    beforeAll(async () => {
      const res = await req()
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Admin123' });
      adminCookies = extractCookies(res);
    });

    it('GET /api/users → admin can list users', async () => {
      const res = await req()
        .get('/api/users')
        .set('Cookie', cookieHeader(adminCookies))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('POST /api/users/:id/reset-password → admin can reset password', async () => {
      const res = await req()
        .post(`/api/users/${medicoUserId}/reset-password`)
        .send({ temporaryPassword: 'NuevaClave123' })
        .set('Cookie', cookieHeader(adminCookies))
        .expect(201);

      expect(res.body.message).toBe('Contraseña restablecida correctamente');
    });

    it('GET /api/users → non-admin gets 403', async () => {
      await req()
        .get('/api/users')
        .set('Cookie', cookieHeader(medicoCookies))
        .expect(403);
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

      const res = await req()
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader(freshCookies))
        .expect(200);

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

    it('POST /api/patients → missing required fields', async () => {
      await req()
        .post('/api/patients')
        .set('Cookie', cookieHeader(medicoCookies))
        .send({ nombre: 'Test' })
        .expect(400);
    });
  });
});
