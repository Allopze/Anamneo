export const MEDICO_ONLY_SECTION_KEYS = ['SOSPECHA_DIAGNOSTICA', 'TRATAMIENTO', 'RESPUESTA_TRATAMIENTO'] as const;
export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function parseBinaryResponse(res: any, callback: (error: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];

  res.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
  res.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
}
