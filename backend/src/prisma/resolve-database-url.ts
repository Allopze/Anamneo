import * as fs from 'fs';
import * as path from 'path';

function toPrismaFileUrl(dbPath: string): string {
  return `file:${dbPath.replace(/\\/g, '/')}`;
}

function pickExistingOrLikelyPath(candidates: string[]): string {
  const existingPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (existingPath) {
    return existingPath;
  }

  const candidateWithExistingDirectory = candidates.find((candidate) =>
    fs.existsSync(path.dirname(candidate)),
  );

  return candidateWithExistingDirectory ?? candidates[0];
}

export function resolveDatabaseUrl(databaseUrl = process.env.DATABASE_URL): string | undefined {
  if (!databaseUrl || !databaseUrl.startsWith('file:')) {
    return databaseUrl;
  }

  const rawPath = databaseUrl.slice('file:'.length);
  if (!rawPath.startsWith('.')) {
    return databaseUrl;
  }

  const cwd = process.cwd();
  const parent = path.resolve(cwd, '..');
  const normalizedRelativePath = rawPath.replace(/^\.\//, '');
  const dbFileName = path.basename(normalizedRelativePath);

  const directCandidates = [
    path.resolve(cwd, rawPath),
    path.resolve(parent, rawPath),
    path.resolve(cwd, rawPath.replace(/^\.\/backend\//, './')),
    path.resolve(parent, rawPath.replace(/^\.\/backend\//, './')),
  ];

  const prismaCandidates = [
    path.resolve(cwd, 'prisma', dbFileName),
    path.resolve(cwd, 'backend', 'prisma', dbFileName),
    path.resolve(parent, 'backend', 'prisma', dbFileName),
  ];

  // "file:./dev.db" is intentionally resolved to the Prisma schema folder DB.
  const candidates = dbFileName === 'dev.db'
    ? [...prismaCandidates, ...directCandidates]
    : [...directCandidates, ...prismaCandidates];

  return toPrismaFileUrl(pickExistingOrLikelyPath(candidates));
}
