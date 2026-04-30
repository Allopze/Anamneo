import 'reflect-metadata';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

const CREATE_AUDIT_LOG_TABLE_SQL = `
  CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    request_id TEXT,
    action TEXT NOT NULL,
    reason TEXT,
    result TEXT NOT NULL DEFAULT 'SUCCESS',
    diff TEXT,
    integrity_hash TEXT,
    previous_hash TEXT,
    timestamp DATETIME NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))
  );

  CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

  CREATE TABLE audit_integrity_snapshots (
    id TEXT PRIMARY KEY NOT NULL,
    valid BOOLEAN NOT NULL,
    checked INTEGER NOT NULL,
    total INTEGER NOT NULL,
    broken_at TEXT,
    warning TEXT,
    verification_scope TEXT NOT NULL,
    verified_at DATETIME NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))
  );
`;

describe('AuditService concurrency', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  let prisma: PrismaService;
  let service: AuditService;
  let tempDbPath: string;

  beforeEach(async () => {
    jest.setTimeout(30000);

    tempDbPath = path.join(
      os.tmpdir(),
      `anamneo-audit-service-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
    );

    fs.rmSync(tempDbPath, { force: true });
    process.env.DATABASE_URL = `file:${tempDbPath}`;
    process.env.NODE_ENV = 'test';

    prisma = new PrismaService();
    await prisma.onModuleInit();
    for (const statement of CREATE_AUDIT_LOG_TABLE_SQL.split(';')) {
      const trimmedStatement = statement.trim();
      if (trimmedStatement) {
        await prisma.$executeRawUnsafe(trimmedStatement);
      }
    }
    service = new AuditService(prisma);
  });

  afterEach(async () => {
    await prisma?.$disconnect();
    fs.rmSync(tempDbPath, { force: true });

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('keeps verifyChain valid under concurrent transactional writes', async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await prisma.auditLog.deleteMany();

      await Promise.all(
        Array.from({ length: 25 }, (_, index) => prisma.$transaction((tx) => service.log({
          entityType: 'Attachment',
          entityId: `attachment-${attempt}-${index}`,
          userId: `user-${index}`,
          requestId: `request-${attempt}-${index}`,
          action: 'CREATE',
          diff: {
            created: {
              filename: `file-${index}.pdf`,
            },
          },
        }, tx))),
      );

      await expect(service.verifyChain()).resolves.toMatchObject({
        valid: true,
        checked: 25,
        total: 25,
      });
    }
  });
});
