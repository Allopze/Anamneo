import 'reflect-metadata';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

jest.setTimeout(30000);

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
    chain_sequence INTEGER,
    timestamp DATETIME NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))
  );

  CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
  CREATE UNIQUE INDEX audit_logs_chain_sequence_key ON audit_logs(chain_sequence);

  CREATE TABLE audit_chain_state (
    id TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
    latest_hash TEXT NOT NULL DEFAULT 'GENESIS',
    sequence INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))
  );

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

  it('keeps verifyChain valid under concurrent service writes', async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await prisma.$executeRawUnsafe('DELETE FROM audit_logs;');
      await prisma.$executeRawUnsafe(
        'INSERT INTO audit_chain_state (id, latest_hash, sequence, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET latest_hash = excluded.latest_hash, sequence = excluded.sequence, updated_at = CURRENT_TIMESTAMP',
        'default',
        'GENESIS',
        0,
      );

      await Promise.all(
        Array.from({ length: 25 }, (_, index) =>
          service.log({
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
          }),
        ),
      );

      await expect(service.verifyChain()).resolves.toMatchObject({
        valid: true,
        checked: 25,
        total: 25,
      });
    }
  });

  it('keeps a single chain across separate service instances sharing the database', async () => {
    const otherPrisma = new PrismaService();
    await otherPrisma.onModuleInit();
    const otherService = new AuditService(otherPrisma);

    try {
      await Promise.all(
        Array.from({ length: 30 }, (_, index) => {
          const targetService = index % 2 === 0 ? service : otherService;
          return targetService.log({
            entityType: 'Attachment',
            entityId: `distributed-attachment-${index}`,
            userId: `distributed-user-${index}`,
            requestId: `distributed-request-${index}`,
            action: 'CREATE',
            diff: {
              created: {
                filename: `distributed-file-${index}.pdf`,
              },
            },
          });
        }),
      );

      await expect(service.verifyChain()).resolves.toMatchObject({
        valid: true,
        checked: 30,
        total: 30,
      });

      const sequences = await prisma.$queryRawUnsafe<Array<{ chainSequence: number | null }>>(
        'SELECT chain_sequence AS chainSequence FROM audit_logs ORDER BY chain_sequence ASC',
      );

      expect(sequences.map((entry) => entry.chainSequence)).toEqual(
        Array.from({ length: 30 }, (_, index) => index + 1),
      );
    } finally {
      await otherPrisma.$disconnect();
    }
  });
});
