const fs = require('node:fs');
const path = require('node:path');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || !databaseUrl.startsWith('file:')) {
  process.exit(0);
}

const sqlitePath = databaseUrl.slice('file:'.length).split('?')[0];

if (!sqlitePath || sqlitePath === ':memory:') {
  process.exit(0);
}

const backendRoot = path.resolve(__dirname, '..');
const dbPath = path.isAbsolute(sqlitePath)
  ? sqlitePath
  : path.resolve(backendRoot, sqlitePath);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const fd = fs.openSync(dbPath, 'a');
fs.closeSync(fd);

