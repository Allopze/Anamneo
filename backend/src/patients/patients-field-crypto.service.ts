import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { decryptField, encryptField, isEncryptionEnabled } from '../common/utils/field-crypto';

/**
 * Ley 21.719 Art 14 quinquies lit a (cifrado y seudonimizacion).
 *
 * Encripta los identificatorios del paciente (RUT, nombre, telefono, email,
 * domicilio, contactoEmergencia*) a nivel aplicacion. Para `rut` (que tiene
 * UNIQUE constraint a nivel DB) ademas calcula un `rut_lookup_hash`
 * deterministico que permite busquedas sin descifrar todos los registros.
 *
 * **Estado:** Phase A — dual-write seguro.
 *   - Las columnas plaintext siguen activas y son la fuente de verdad para
 *     lecturas existentes.
 *   - Las columnas `*_enc` y `rut_lookup_hash` se populan en cada write.
 *   - El cifrado se omite (no-op) en dev/test sin `ENCRYPTION_KEY`.
 *
 * **Phase B (futuro):** backfill de registros existentes, switch de reads
 * a las columnas `*_enc`, drop de plaintext columns. Ver documentacion del
 * roadmap.
 */
@Injectable()
export class PatientsFieldCryptoService {
  private readonly logger = new Logger(PatientsFieldCryptoService.name);

  /**
   * HMAC-SHA256 deterministico del RUT usando `ENCRYPTION_KEY` como base.
   * Normaliza el RUT antes (lowercase, sin puntos ni guion) para que el
   * lookup funcione independientemente del formato de entrada.
   */
  computeRutLookupHash(rut: string | null | undefined): string | null {
    if (!rut) return null;
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
      // En dev/test sin clave, no podemos calcular el hash de lookup.
      // Esto no rompe nada porque las queries existentes siguen usando rut plaintext.
      return null;
    }
    const normalized = rut
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
    if (!normalized) return null;
    // Pepper estatico para diferenciar este hash de otros usos del HMAC con
    // la misma clave. Cualquier cambio en este string invalida los hashes
    // existentes — no cambiar sin un migration script de backfill.
    const PEPPER = 'anamneo.v1.patient.rut_lookup';
    return createHmac('sha256', Buffer.from(key, 'hex'))
      .update(PEPPER + ':' + normalized)
      .digest('hex');
  }

  /**
   * Encripta un valor escalar (string). Si la clave no esta configurada,
   * devuelve null para que el dual-write deje las columnas `_enc` vacias.
   * El plaintext sigue intacto en la columna original.
   */
  encryptScalar(value: string | null | undefined): string | null {
    if (value == null || value === '') return null;
    if (!isEncryptionEnabled()) return null;
    try {
      return encryptField(value);
    } catch (err) {
      this.logger.warn(`encryptScalar failed: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Descifra un valor `_enc` si esta presente y la clave esta disponible.
   * Devuelve null cuando no se puede descifrar (uso defensivo en presenters).
   */
  decryptScalar(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
      return decryptField(value);
    } catch (err) {
      this.logger.warn(`decryptScalar failed: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Construye el payload de cifrado para los identificatorios de un Patient.
   * Uso tipico:
   *
   *   const enc = patientsFieldCrypto.buildEncryptedFields({
   *     rut: dto.rut, nombre: dto.nombre, ...
   *   });
   *   await prisma.patient.create({ data: { ...dto, ...enc } });
   *
   * El resultado contiene SIEMPRE las claves esperadas; los valores son
   * `null` cuando el cifrado no esta disponible o el campo es vacio.
   */
  buildEncryptedFields(input: {
    rut?: string | null;
    nombre?: string | null;
    telefono?: string | null;
    email?: string | null;
    domicilio?: string | null;
    contactoEmergenciaNombre?: string | null;
    contactoEmergenciaTelefono?: string | null;
  }): {
    rutEnc: string | null;
    rutLookupHash: string | null;
    nombreEnc: string | null;
    telefonoEnc: string | null;
    emailEnc: string | null;
    domicilioEnc: string | null;
    contactoEmergenciaNombreEnc: string | null;
    contactoEmergenciaTelefonoEnc: string | null;
  } {
    return {
      rutEnc: this.encryptScalar(input.rut),
      rutLookupHash: this.computeRutLookupHash(input.rut),
      nombreEnc: this.encryptScalar(input.nombre),
      telefonoEnc: this.encryptScalar(input.telefono),
      emailEnc: this.encryptScalar(input.email),
      domicilioEnc: this.encryptScalar(input.domicilio),
      contactoEmergenciaNombreEnc: this.encryptScalar(input.contactoEmergenciaNombre),
      contactoEmergenciaTelefonoEnc: this.encryptScalar(input.contactoEmergenciaTelefono),
    };
  }
}
