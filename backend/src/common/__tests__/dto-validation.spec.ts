import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from '../../auth/dto/register.dto';
import { LoginDto } from '../../auth/dto/login.dto';
import { CreatePatientQuickDto } from '../../patients/dto/create-patient-quick.dto';
import { UpdatePatientHistoryDto } from '../../patients/dto/update-patient-history.dto';
import { UpdatePatientTaskStatusDto } from '../../patients/dto/update-patient-task-status.dto';
import { UpdateSectionDto } from '../../encounters/dto/update-section.dto';
import { SignEncounterDto } from '../../encounters/dto/sign-encounter.dto';
import { ChangePasswordDto } from '../../auth/dto/change-password.dto';
import { CreateConsentDto, RevokeConsentDto } from '../../consents/dto/consent.dto';
import { CreateAlertDto } from '../../alerts/dto/alert.dto';
import { ClinicalAnalyticsQueryDto } from '../../analytics/dto/clinical-analytics-query.dto';
import { ClinicalAnalyticsCasesQueryDto } from '../../analytics/dto/clinical-analytics-cases-query.dto';
import { UpdateReviewStatusDto } from '../../encounters/dto/update-review-status.dto';
import { UploadAttachmentDto } from '../../attachments/dto/upload-attachment.dto';
import { CreateTemplateDto, UpdateTemplateDto } from '../../templates/dto/template.dto';
import { SaveSuggestionDto } from '../../conditions/dto/save-suggestion.dto';
import { CompleteEncounterDto } from '../../encounters/dto/complete-encounter.dto';

describe('DTO Validation', () => {
  describe('RegisterDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'Password1',
        nombre: 'Test User',
        role: 'MEDICO',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid email', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'not-an-email',
        password: 'Password1',
        nombre: 'Test',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('should fail with short password', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'Ab1',
        nombre: 'Test',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('should fail with password exceeding 72 chars', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'A1' + 'a'.repeat(71),
        nombre: 'Test',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('should allow password with dot', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'Password1.',
        nombre: 'Test',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password')).toBe(false);
    });

    it('should fail with password containing spaces', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'Password 1',
        nombre: 'Test',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('should accept ADMIN role', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'Password1',
        nombre: 'Test User',
        role: 'ADMIN',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'role')).toBe(false);
    });

    it('should accept MEDICO role', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'Password1',
        nombre: 'Test User',
        role: 'MEDICO',
      });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'role').length).toBe(0);
    });

    it('should accept ASISTENTE role', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'Password1',
        nombre: 'Test User',
        role: 'ASISTENTE',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'role')).toBe(false);
    });

    it('should reject unknown role', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'Password1',
        nombre: 'Test User',
        role: 'ENFERMERO',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'role')).toBe(true);
    });

    it('should trim and lowercase email', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: '  TEST@Example.COM  ',
        password: 'Password1',
        nombre: 'Test',
      });
      expect(dto.email).toBe('test@example.com');
    });

    it('should trim nombre', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'Password1',
        nombre: '  Juan Carlos  ',
      });
      expect(dto.nombre).toBe('Juan Carlos');
    });
  });

  describe('LoginDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'test@example.com',
        password: 'password',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with empty password', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'test@example.com',
        password: '',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });
  });

  describe('CreatePatientQuickDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(CreatePatientQuickDto, {
        nombre: 'Juan Pérez',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with name shorter than 2 chars', async () => {
      const dto = plainToInstance(CreatePatientQuickDto, {
        nombre: 'J',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'nombre')).toBe(true);
    });

    it('should fail with name exceeding 200 chars', async () => {
      const dto = plainToInstance(CreatePatientQuickDto, {
        nombre: 'A'.repeat(201),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'nombre')).toBe(true);
    });

    it('should trim optional rut fields and normalize blank values', async () => {
      const dto = plainToInstance(CreatePatientQuickDto, {
        nombre: 'Juan Pérez',
        rut: '  ',
        rutExemptReason: '  Sin documento nacional  ',
      });

      expect(dto.rut).toBeUndefined();
      expect(dto.rutExemptReason).toBe('Sin documento nacional');

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('UpdateSectionDto', () => {
    it('should pass with valid data object', async () => {
      const dto = plainToInstance(UpdateSectionDto, {
        data: { motivo: 'dolor de cabeza' },
        baseUpdatedAt: '2026-04-17T10:00:00.000Z',
        completed: false,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when data is not an object', async () => {
      const dto = plainToInstance(UpdateSectionDto, {
        data: 'not an object',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'data')).toBe(true);
    });

    it('should fail when data is an array payload', async () => {
      const dto = plainToInstance(UpdateSectionDto, {
        data: ['motivo', 'dolor'],
      });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'data')).toBe(true);
    });

    it('should accept completed as optional', async () => {
      const dto = plainToInstance(UpdateSectionDto, {
        data: { motivo: 'dolor' },
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when baseUpdatedAt is not an ISO date', async () => {
      const dto = plainToInstance(UpdateSectionDto, {
        data: { motivo: 'dolor' },
        baseUpdatedAt: 'ayer',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'baseUpdatedAt')).toBe(true);
    });

    it('should require a trimmed reason when marking section as not applicable', async () => {
      const dto = plainToInstance(UpdateSectionDto, {
        data: { motivo: 'dolor' },
        notApplicable: true,
        notApplicableReason: '   ',
      });

      expect(dto.notApplicableReason).toBeUndefined();

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'notApplicableReason')).toBe(true);
    });

    it('should reject oversized notApplicableReason', async () => {
      const dto = plainToInstance(UpdateSectionDto, {
        data: { motivo: 'dolor' },
        notApplicable: true,
        notApplicableReason: 'A'.repeat(1001),
      });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'notApplicableReason')).toBe(true);
    });

    it('should reject section payloads with too many top-level keys', async () => {
      const data = Object.fromEntries(Array.from({ length: 121 }, (_, idx) => [`campo${idx}`, `valor ${idx}`]));

      const dto = plainToInstance(UpdateSectionDto, {
        data,
      });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'data')).toBe(true);
    });

    it('should reject section payloads with oversized serialized content', async () => {
      const dto = plainToInstance(UpdateSectionDto, {
        data: {
          motivo: 'A'.repeat(120001),
        },
      });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'data')).toBe(true);
    });
  });

  describe('UpdatePatientHistoryDto', () => {
    it('should sanitize and accept valid nested history objects', async () => {
      const dto = plainToInstance(UpdatePatientHistoryDto, {
        antecedentesMedicos: {
          texto: '  Hipertensión controlada  ',
          items: ['HTA', ' HTA ', '  '],
        },
      });

      expect(dto.antecedentesMedicos?.texto).toBe('Hipertensión controlada');
      expect(dto.antecedentesMedicos?.items).toEqual(['HTA']);

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should reject invalid nested history item types', async () => {
      const dto = plainToInstance(UpdatePatientHistoryDto, {
        alergias: {
          items: ['Penicilina', 42],
        },
      });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'alergias')).toBe(true);
    });
  });

  describe('ChangePasswordDto', () => {
    it('should pass with valid passwords', async () => {
      const dto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'OldPass1',
        newPassword: 'NewPass1',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow new password with dot', async () => {
      const dto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'OldPass1',
        newPassword: 'NewPass1.',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'newPassword')).toBe(false);
    });

    it('should fail with short new password', async () => {
      const dto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'OldPass1',
        newPassword: 'Ab1',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
    });

    it('should fail with spaces in new password', async () => {
      const dto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'OldPass1',
        newPassword: 'New Pass1',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
    });
  });

  describe('UpdatePatientTaskStatusDto', () => {
    it('should accept recurrenceRule updates with a valid dueDate', async () => {
      const dto = plainToInstance(UpdatePatientTaskStatusDto, {
        recurrenceRule: 'MONTHLY',
        dueDate: '2026-04-20',
      });

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should normalize an empty dueDate to null for clearing an existing schedule', async () => {
      const dto = plainToInstance(UpdatePatientTaskStatusDto, {
        recurrenceRule: 'NONE',
        dueDate: '',
      });

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
      expect(dto.dueDate).toBeNull();
    });

    it('should reject an unknown recurrenceRule', async () => {
      const dto = plainToInstance(UpdatePatientTaskStatusDto, {
        recurrenceRule: 'YEARLY',
      });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'recurrenceRule')).toBe(true);
    });
  });

  describe('Consent DTOs', () => {
    it('should reject an invalid patientId in CreateConsentDto', async () => {
      const dto = plainToInstance(CreateConsentDto, {
        patientId: 'not-a-uuid',
        type: 'TRATAMIENTO',
        description: 'Consentimiento informado',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'patientId')).toBe(true);
    });

    it('should trim and reject too-short revoke reasons', async () => {
      const dto = plainToInstance(RevokeConsentDto, {
        reason: '  ',
      });
      expect(dto.reason).toBe('');
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reason')).toBe(true);
    });
  });

  describe('CreateAlertDto', () => {
    it('should reject an invalid encounterId', async () => {
      const dto = plainToInstance(CreateAlertDto, {
        patientId: '7f7836e2-cf8d-4fe4-82a0-2dc0b4a0cc01',
        encounterId: 'bad-id',
        type: 'GENERAL',
        severity: 'MEDIA',
        title: 'Alerta breve',
        message: 'Mensaje clínico válido',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'encounterId')).toBe(true);
    });

    it('should trim and reject too-short title and message', async () => {
      const dto = plainToInstance(CreateAlertDto, {
        patientId: '7f7836e2-cf8d-4fe4-82a0-2dc0b4a0cc01',
        type: 'GENERAL',
        severity: 'MEDIA',
        title: ' ',
        message: ' ',
      });
      expect(dto.title).toBe('');
      expect(dto.message).toBe('');
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
      expect(errors.some((e) => e.property === 'message')).toBe(true);
    });
  });

  describe('Clinical analytics DTOs', () => {
    it('should trim condition and reject oversized summary filters', async () => {
      const dto = plainToInstance(ClinicalAnalyticsQueryDto, {
        condition: `  ${'A'.repeat(301)}  `,
      });

      expect(dto.condition).toBe('A'.repeat(301));
      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'condition')).toBe(true);
    });

    it('should reject focusType without focusValue in cases query', async () => {
      const dto = plainToInstance(ClinicalAnalyticsCasesQueryDto, {
        condition: 'Dolor abdominal',
        focusType: 'MEDICATION',
      });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'focusValue')).toBe(true);
    });

    it('should reject focusValue without focusType in cases query', async () => {
      const dto = plainToInstance(ClinicalAnalyticsCasesQueryDto, {
        condition: 'Dolor abdominal',
        focusValue: 'Paracetamol',
      });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'focusType')).toBe(true);
    });

    it('should trim and accept paired focus filters in cases query', async () => {
      const dto = plainToInstance(ClinicalAnalyticsCasesQueryDto, {
        condition: ' Dolor abdominal ',
        focusType: 'MEDICATION',
        focusValue: ' Paracetamol ',
      });

      expect(dto.condition).toBe('Dolor abdominal');
      expect(dto.focusValue).toBe('Paracetamol');

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('UpdateReviewStatusDto', () => {
    it('should require a trimmed review note when marking an encounter as reviewed', async () => {
      const dto = plainToInstance(UpdateReviewStatusDto, {
        reviewStatus: 'REVISADA_POR_MEDICO',
        note: '   ',
      });

      expect(dto.note).toBeUndefined();

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'note')).toBe(true);
    });

    it('should trim and accept an optional review note for pending review', async () => {
      const dto = plainToInstance(UpdateReviewStatusDto, {
        reviewStatus: 'LISTA_PARA_REVISION',
        note: '  Revisar contexto clínico  ',
      });

      expect(dto.note).toBe('Revisar contexto clínico');

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('SignEncounterDto', () => {
    it('should reject passwords exceeding 72 characters', async () => {
      const dto = plainToInstance(SignEncounterDto, {
        password: `A1${'a'.repeat(71)}`,
      });

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });
  });

  describe('UploadAttachmentDto', () => {
    it('should trim optional metadata and normalize blanks', async () => {
      const dto = plainToInstance(UploadAttachmentDto, {
        category: '  ',
        description: '  Control de laboratorio  ',
        linkedOrderType: '  EXAMEN  ',
        linkedOrderId: '  ',
      });

      expect(dto.category).toBeUndefined();
      expect(dto.description).toBe('Control de laboratorio');
      expect(dto.linkedOrderType).toBe('EXAMEN');
      expect(dto.linkedOrderId).toBeUndefined();

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('Template DTOs', () => {
    it('should trim and reject blank required fields in CreateTemplateDto', async () => {
      const dto = plainToInstance(CreateTemplateDto, {
        name: '  ',
        content: '  ',
      });

      expect(dto.name).toBe('');
      expect(dto.content).toBe('');

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'name')).toBe(true);
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });

    it('should trim optional fields in UpdateTemplateDto and drop blank values', async () => {
      const dto = plainToInstance(UpdateTemplateDto, {
        name: '  Resumen clínico  ',
        content: '  Plantilla base  ',
        sectionKey: '  ',
      });

      expect(dto.name).toBe('Resumen clínico');
      expect(dto.content).toBe('Plantilla base');
      expect(dto.sectionKey).toBeUndefined();

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('SaveSuggestionDto', () => {
    it('should trim and reject blank inputText', async () => {
      const dto = plainToInstance(SaveSuggestionDto, {
        inputText: '  ',
        chosenConditionId: null,
        chosenMode: 'AUTO',
        suggestions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Gastritis',
            score: 10,
            confidence: 80,
          },
        ],
      });

      expect(dto.inputText).toBe('');

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'inputText')).toBe(true);
    });

    it('should trim nested suggestion names and normalize blank snapshots', async () => {
      const dto = plainToInstance(SaveSuggestionDto, {
        inputText: '  dolor epigástrico  ',
        persistedTextSnapshot: '   ',
        chosenConditionId: null,
        chosenMode: 'MANUAL',
        suggestions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            name: '  Gastritis erosiva  ',
            score: 12,
            confidence: 90,
          },
        ],
      });

      expect(dto.inputText).toBe('dolor epigástrico');
      expect(dto.persistedTextSnapshot).toBeUndefined();
      expect(dto.suggestions[0].name).toBe('Gastritis erosiva');

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('CompleteEncounterDto', () => {
    it('should trim and reject a too-short closure note when provided', async () => {
      const dto = plainToInstance(CompleteEncounterDto, {
        closureNote: '   breve   ',
      });

      expect(dto.closureNote).toBe('breve');

      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'closureNote')).toBe(true);
    });

    it('should accept a trimmed valid closure note', async () => {
      const dto = plainToInstance(CompleteEncounterDto, {
        closureNote: '  Evolución clínica estable y plan indicado  ',
      });

      expect(dto.closureNote).toBe('Evolución clínica estable y plan indicado');

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });
});
