import * as path from 'path';
import { resolveUploadsRoot } from './uploads-root';

describe('resolveUploadsRoot', () => {
  const appRoot = path.resolve('/srv/anamneo/backend');

  it('resuelve rutas relativas dentro del app root', () => {
    expect(resolveUploadsRoot('./uploads', appRoot)).toBe(
      path.join(appRoot, 'uploads'),
    );
  });

  it('permite rutas absolutas dentro del app root', () => {
    expect(resolveUploadsRoot('/srv/anamneo/backend/runtime/uploads', appRoot)).toBe(
      '/srv/anamneo/backend/runtime/uploads',
    );
  });

  it('rechaza rutas fuera del app root', () => {
    expect(() => resolveUploadsRoot('../uploads', appRoot)).toThrow(
      /UPLOAD_DEST debe permanecer dentro de/,
    );
  });
});
