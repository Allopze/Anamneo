import * as path from 'path';

const DEFAULT_UPLOAD_DEST = './uploads';

export function resolveUploadsRoot(
  configuredUploadDest?: string,
  appRoot = process.cwd(),
): string {
  const normalizedAppRoot = path.resolve(appRoot);
  const uploadDest = configuredUploadDest?.trim() || DEFAULT_UPLOAD_DEST;
  const absoluteUploadPath = path.isAbsolute(uploadDest)
    ? path.normalize(uploadDest)
    : path.resolve(normalizedAppRoot, uploadDest);
  const relativeToAppRoot = path.relative(normalizedAppRoot, absoluteUploadPath);

  if (
    relativeToAppRoot.startsWith('..')
    || path.isAbsolute(relativeToAppRoot)
  ) {
    throw new Error(
      `UPLOAD_DEST debe permanecer dentro de ${normalizedAppRoot}. Valor recibido: ${uploadDest}`,
    );
  }

  return absoluteUploadPath;
}
