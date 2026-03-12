"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDatabaseUrl = resolveDatabaseUrl;
const fs = require("fs");
const path = require("path");
function toPrismaFileUrl(dbPath) {
    return `file:${dbPath.replace(/\\/g, '/')}`;
}
function resolveDatabaseUrl(databaseUrl = process.env.DATABASE_URL) {
    if (!databaseUrl || !databaseUrl.startsWith('file:')) {
        return databaseUrl;
    }
    const rawPath = databaseUrl.slice('file:'.length);
    if (!rawPath.startsWith('.')) {
        return databaseUrl;
    }
    const cwd = process.cwd();
    const parent = path.resolve(cwd, '..');
    const trimmedBackendPrefix = rawPath.replace(/^\.\/backend\//, './');
    const candidates = [
        path.resolve(cwd, rawPath),
        path.resolve(parent, rawPath),
        path.resolve(cwd, trimmedBackendPrefix),
        path.resolve(parent, trimmedBackendPrefix),
    ];
    const existingPath = candidates.find((candidate) => fs.existsSync(candidate));
    return toPrismaFileUrl(existingPath ?? candidates[0]);
}
//# sourceMappingURL=resolve-database-url.js.map