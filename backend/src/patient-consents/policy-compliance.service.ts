import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PatientConsentsService } from './patient-consents.service';

/**
 * Ley 21.719 Art 12 + Art 16 + Art 16 quater.
 *
 * Centraliza la verificacion de que un Patient tiene consentimiento del
 * titular vigente para una finalidad determinada antes de permitir su
 * tratamiento.
 *
 * MODO DE OPERACION (controlado por env):
 *   - REGULATORY_CONSENT_ENFORCEMENT=hard  -> lanza ForbiddenException
 *   - REGULATORY_CONSENT_ENFORCEMENT=soft  -> solo loggea warning (default
 *     mientras dura la migracion de pacientes existentes en Ola 1)
 *   - REGULATORY_CONSENT_ENFORCEMENT=off   -> desactivado (solo dev/test)
 *
 * El gate final del roadmap (Ola 4 Go/No-Go) exige `hard` en produccion.
 */
@Injectable()
export class PolicyComplianceService {
  private readonly logger = new Logger(PolicyComplianceService.name);

  constructor(private readonly consents: PatientConsentsService) {}

  private get mode(): 'hard' | 'soft' | 'off' {
    const raw = (process.env.REGULATORY_CONSENT_ENFORCEMENT || 'soft').toLowerCase();
    if (raw === 'hard' || raw === 'soft' || raw === 'off') return raw;
    return 'soft';
  }

  async assertConsentFor(patientId: string, purpose: string) {
    if (this.mode === 'off') return;
    const ok = await this.consents.hasVigentConsentForActivePrivacyPolicy(patientId, purpose);
    if (ok) return;
    const msg =
      `Paciente ${patientId} no tiene consentimiento vigente del titular para ` +
      `finalidad ${purpose} sobre la politica de privacidad publicada ` +
      `(Ley 21.719 Art 12).`;
    if (this.mode === 'hard') {
      throw new ForbiddenException({ code: 'PATIENT_CONSENT_REQUIRED', patientId, purpose, message: msg });
    }
    this.logger.warn(`[policy-compliance:soft] ${msg}`);
  }
}
