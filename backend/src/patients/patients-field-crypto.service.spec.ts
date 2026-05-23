import { PatientsFieldCryptoService } from './patients-field-crypto.service';

describe('PatientsFieldCryptoService', () => {
  // Clave fija para tests; 64 hex chars
  const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let originalKey: string | undefined;

  beforeAll(() => {
    originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = originalKey;
  });

  const service = new PatientsFieldCryptoService();

  describe('computeRutLookupHash', () => {
    it('devuelve null para input vacio', () => {
      expect(service.computeRutLookupHash(null)).toBeNull();
      expect(service.computeRutLookupHash('')).toBeNull();
      expect(service.computeRutLookupHash(undefined)).toBeNull();
    });

    it('normaliza puntos, guion y mayusculas (mismo hash para variantes)', () => {
      const h1 = service.computeRutLookupHash('12.345.678-9');
      const h2 = service.computeRutLookupHash('12345678-9');
      const h3 = service.computeRutLookupHash('12345678 9');
      const h4 = service.computeRutLookupHash('123456789');
      const h5 = service.computeRutLookupHash('12345678-K');
      // 1-4 deben coincidir
      expect(h1).toBe(h2);
      expect(h1).toBe(h3);
      expect(h1).toBe(h4);
      // 5 distinto (digito verificador K)
      expect(h1).not.toBe(h5);
    });

    it('es deterministico para la misma clave', () => {
      const h1 = service.computeRutLookupHash('12345678-9');
      const h2 = service.computeRutLookupHash('12345678-9');
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('requiere ENCRYPTION_KEY para calcular lookup hash', () => {
      const prev = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;
      try {
        expect(() => service.computeRutLookupHash('12345678-9')).toThrow('ENCRYPTION_KEY must be a 64-character hex string');
      } finally {
        process.env.ENCRYPTION_KEY = prev;
      }
    });
  });

  describe('encryptScalar / decryptScalar', () => {
    it('round-trip de string', () => {
      const enc = service.encryptScalar('Juan Pérez');
      expect(enc).toMatch(/^enc:v1:/);
      const dec = service.decryptScalar(enc);
      expect(dec).toBe('Juan Pérez');
    });

    it('devuelve null para valores vacios', () => {
      expect(service.encryptScalar(null)).toBeNull();
      expect(service.encryptScalar('')).toBeNull();
      expect(service.encryptScalar(undefined)).toBeNull();
    });

    it('cifrado no es deterministico (IV aleatorio por llamada)', () => {
      const e1 = service.encryptScalar('test');
      const e2 = service.encryptScalar('test');
      expect(e1).not.toBe(e2);
      // pero ambos descifran al mismo plaintext
      expect(service.decryptScalar(e1)).toBe('test');
      expect(service.decryptScalar(e2)).toBe('test');
    });
  });

  describe('buildEncryptedFields', () => {
    it('cifra todos los campos provistos y calcula rut_lookup_hash', () => {
      const enc = service.buildEncryptedFields({
        rut: '12.345.678-9',
        nombre: 'Juan Pérez',
        telefono: '+56987654321',
        email: 'juan@example.cl',
        domicilio: 'Av. Siempreviva 742',
        contactoEmergenciaNombre: 'María',
        contactoEmergenciaTelefono: '+56999999999',
      });
      expect(enc.rutEnc).toMatch(/^enc:v1:/);
      expect(enc.rutLookupHash).toMatch(/^[0-9a-f]{64}$/);
      expect(enc.nombreEnc).toMatch(/^enc:v1:/);
      expect(enc.telefonoEnc).toMatch(/^enc:v1:/);
      expect(enc.emailEnc).toMatch(/^enc:v1:/);
      expect(enc.domicilioEnc).toMatch(/^enc:v1:/);
      expect(enc.contactoEmergenciaNombreEnc).toMatch(/^enc:v1:/);
      expect(enc.contactoEmergenciaTelefonoEnc).toMatch(/^enc:v1:/);
    });

    it('null para campos vacios', () => {
      const enc = service.buildEncryptedFields({});
      expect(enc.rutEnc).toBeNull();
      expect(enc.rutLookupHash).toBeNull();
      expect(enc.nombreEnc).toBeNull();
    });

    it('rut_lookup_hash deterministico para mismo input', () => {
      const a = service.buildEncryptedFields({ rut: '12.345.678-9' });
      const b = service.buildEncryptedFields({ rut: '12.345.678-9' });
      expect(a.rutLookupHash).toBe(b.rutLookupHash);
    });
  });
});
