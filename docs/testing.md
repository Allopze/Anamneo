# Testing

Anamneo tiene tres superficies de pruebas principales: Jest backend, Jest frontend y Playwright frontend. No estan mal, pero tampoco son tan magicas como para adivinar contexto por osmosis.

## Resumen Rapido

| Superficie | Comando | Nota |
|---|---|---|
| Backend unit/integration | `npm --prefix backend run test` | Jest sobre `src/**/*.spec.ts` |
| Backend coverage | `npm --prefix backend run test:cov` | Coverage backend |
| Backend e2e | `npm --prefix backend run test:e2e` | Usa `backend/test/jest-e2e.json` |
| Frontend unit | `npm --prefix frontend run test` | Jest con `next/jest` |
| Frontend watch | `npm --prefix frontend run test:watch` | Loop de desarrollo |
| Frontend e2e | `npm --prefix frontend run test:e2e` | Playwright sobre `frontend/tests/e2e` |

## Backend

### Jest normal

- `backend/package.json` define `testRegex: .*\.spec\.ts$`.
- El entorno es `node`.
- La cobertura se escribe en `backend/coverage/`.

### e2e

- `npm --prefix backend run test:e2e` ejecuta `jest --config ./test/jest-e2e.json`.
- Antes corre `prisma generate` via `pretest:e2e`.
- El archivo `backend/test/app.e2e-spec.ts` es secuencial y comparte estado entre tests.

Consecuencia importante:

- no conviene filtrar ese archivo con `--testNamePattern`,
- porque reutiliza cookies, ids y estado inicializado en otros bloques,
- y el resultado tiende a ser confuso en vez de util.

## Frontend

### Jest

- Usa `next/jest` en `frontend/jest.config.js`.
- El entorno es `jsdom`.
- Los tests viven bajo `frontend/src/`.
- `frontend/src/__tests__/setup.ts` se carga en `setupFilesAfterEnv`.

### Playwright

- La configuracion vive en `frontend/playwright.config.ts`.
- `baseURL` es `http://127.0.0.1:5555`.
- El `webServer` levanta `npm run dev` dentro de `frontend/`.
- `fullyParallel` esta desactivado.

Importante:

- Playwright levanta el frontend, no el backend.
- Si la prueba requiere trafico real contra `/api`, necesitas el backend disponible en `:5678`.
- El proxy de Next.js reescribe `/api/*` al backend configurado, por lo que una API caida no se arregla con optimismo.

## Flujo Recomendado Antes de Cerrar Cambios

### Si tocaste backend puro

1. `npm --prefix backend run typecheck`
2. `npm --prefix backend run test`
3. `npm --prefix backend run test:e2e` si cambiaste endpoints, permisos o persistencia

### Si tocaste frontend puro

1. `npm --prefix frontend run typecheck`
2. `npm --prefix frontend run test`
3. `npm --prefix frontend run test:e2e` si cambiaste rutas, autenticacion o UX critica

### Si tocaste contratos frontend/backend

Corre ambos lados. Cuando hay drift, rara vez se arregla mirando uno solo con cara de decepcion.

## Riesgos Conocidos

- Hay antecedentes de drift entre frontend y backend en 2FA, consentimientos y serializacion de secciones de encounter.
- Los tests e2e backend no son buenos candidatos para ejecucion parcial por nombre.
- Los selectores E2E frontend pueden volverse fragiles si se cambian clases o textos sin criterio.

## Criterio Para Agregar Tests

- Endpoint nuevo: agrega test backend.
- Cambio de permisos: agrega test backend y, si hay UI visible, tambien test frontend.
- Cambio de flujo clinico: cubre el happy path y al menos una negacion por permisos o estado.
- Fix de regression: escribe el test primero o inmediatamente despues del fix, no cuando la memoria ya se puso creativa.