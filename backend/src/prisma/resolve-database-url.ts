export function resolveDatabaseUrl(databaseUrl = process.env.DATABASE_URL): string | undefined {
  if (!databaseUrl) {
    return undefined;
  }

  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must use PostgreSQL');
  }

  return databaseUrl;
}
