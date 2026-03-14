"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const helmet_1 = require("helmet");
const cookieParser = require("cookie-parser");
const crypto_1 = require("crypto");
const app_module_1 = require("./app.module");
function assertSafeConfig(configService) {
    const databaseUrl = configService.get('DATABASE_URL');
    const jwtSecret = configService.get('JWT_SECRET');
    const jwtRefreshSecret = configService.get('JWT_REFRESH_SECRET');
    const placeholderValues = new Set([
        'replace-with-a-secure-random-secret',
        'replace-with-a-different-secure-random-secret',
        'change_this_in_production',
        'change_this_refresh_secret_too',
    ]);
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required');
    }
    if (!databaseUrl.startsWith('file:')) {
        throw new Error('DATABASE_URL must use SQLite file URL format (file:...)');
    }
    if (databaseUrl.includes('change-me')) {
        throw new Error('DATABASE_URL must not contain placeholder values');
    }
    if (!jwtSecret || placeholderValues.has(jwtSecret)) {
        throw new Error('JWT_SECRET must be configured with a non-placeholder value');
    }
    if (!jwtRefreshSecret || placeholderValues.has(jwtRefreshSecret)) {
        throw new Error('JWT_REFRESH_SECRET must be configured with a non-placeholder value');
    }
}
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableShutdownHooks();
    let isShuttingDown = false;
    const shutdown = async (signal) => {
        if (isShuttingDown) {
            return;
        }
        isShuttingDown = true;
        console.log(JSON.stringify({
            level: 'info',
            event: 'shutdown_signal_received',
            signal,
        }));
        try {
            await app.close();
            console.log(JSON.stringify({
                level: 'info',
                event: 'server_stopped',
                signal,
            }));
            process.exit(0);
        }
        catch (error) {
            console.error(JSON.stringify({
                level: 'error',
                event: 'shutdown_failed',
                signal,
                message: error instanceof Error ? error.message : 'unknown_error',
            }));
            process.exit(1);
        }
    };
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
        process.once(signal, () => {
            void shutdown(signal);
        });
    }
    const configService = app.get(config_1.ConfigService);
    assertSafeConfig(configService);
    app.use((0, helmet_1.default)());
    app.use(cookieParser());
    app.use((req, res, next) => {
        const startedAt = process.hrtime.bigint();
        const headerRequestId = req.headers['x-request-id'];
        const requestId = typeof headerRequestId === 'string' && headerRequestId.trim().length > 0
            ? headerRequestId.trim()
            : (0, crypto_1.randomUUID)();
        req.headers['x-request-id'] = requestId;
        res.setHeader('x-request-id', requestId);
        res.on('finish', () => {
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
            const logEntry = {
                level: res.statusCode >= 500 ? 'error' : 'info',
                event: 'http_request',
                requestId,
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                durationMs: Number(durationMs.toFixed(2)),
            };
            const serialized = JSON.stringify(logEntry);
            if (res.statusCode >= 500) {
                console.error(serialized);
                return;
            }
            console.log(serialized);
        });
        next();
    });
    const corsOriginEnv = configService.get('CORS_ORIGIN', 'http://localhost:5555');
    const corsOrigins = corsOriginEnv.split(',').map((origin) => origin.trim());
    console.log(JSON.stringify({
        level: 'info',
        event: 'config_loaded',
        corsOrigins,
    }));
    app.enableCors({
        origin: corsOrigins,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));
    app.setGlobalPrefix('api');
    const port = configService.get('PORT', 4444);
    await app.listen(port, '0.0.0.0');
    console.log(JSON.stringify({
        level: 'info',
        event: 'server_started',
        port,
        url: `http://localhost:${port}`,
    }));
}
bootstrap().catch((error) => {
    console.error(JSON.stringify({
        level: 'error',
        event: 'bootstrap_failed',
        message: error instanceof Error ? error.message : 'unknown_error',
    }));
    process.exit(1);
});
//# sourceMappingURL=main.js.map