import { Injectable, Logger } from '@nestjs/common';
import {
  buildEncryptedPatientIdentifierFields,
  computeRutLookupHash,
  decryptPatientIdentifier,
} from './patients-identifiers';

/**
 * Ley 21.719 Art 14 quinquies lit a (cifrado y seudonimizacion).
 *
 * Encripta los identificatorios del paciente (RUT, nombre, telefono, email,
 * domicilio, contactoEmergencia*) a nivel aplicacion. Para `rut` (que tiene
 * UNIQUE constraint a nivel DB) ademas calcula un `rut_lookup_hash`
 * deterministico que permite busquedas sin descifrar todos los registros.
 *
 * **Estado:** Phase C — las columnas plaintext ya no forman parte del
 * modelo Prisma. Los write paths deben persistir solo `*_enc` y
 * `rut_lookup_hash`; los read paths descifran desde esas columnas.
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
    return computeRutLookupHash(rut);
  }

  /**
   * Encripta un valor escalar (string). ENCRYPTION_KEY es obligatoria en
   * startup; se conserva el try/catch para no romper callers legacy de tests.
   */
  encryptScalar(value: string | null | undefined): string | null {
    try {
      return buildEncryptedPatientIdentifierFields({ nombre: value }).nombreEnc;
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
    try {
      return decryptPatientIdentifier(value);
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
   * `null` cuando el campo es vacio.
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
    return buildEncryptedPatientIdentifierFields(input);
  }
}
