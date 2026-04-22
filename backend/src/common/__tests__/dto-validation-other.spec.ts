import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateConsentDto, RevokeConsentDto } from '../../consents/dto/consent.dto';
import { CreateAlertDto } from '../../alerts/dto/alert.dto';
import { ClinicalAnalyticsQueryDto } from '../../analytics/dto/clinical-analytics-query.dto';
import { ClinicalAnalyticsCasesQueryDto } from '../../analytics/dto/clinical-analytics-cases-query.dto';
import { UploadAttachmentDto } from '../../attachments/dto/upload-attachment.dto';
import { CreateTemplateDto, UpdateTemplateDto } from '../../templates/dto/template.dto';
import { SaveSuggestionDto } from '../../conditions/dto/save-suggestion.dto';

describe('DTO Validation — Other', () => {
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
});
