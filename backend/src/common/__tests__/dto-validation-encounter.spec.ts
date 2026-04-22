import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateSectionDto } from '../../encounters/dto/update-section.dto';
import { UpdateReviewStatusDto } from '../../encounters/dto/update-review-status.dto';
import { SignEncounterDto } from '../../encounters/dto/sign-encounter.dto';
import { CompleteEncounterDto } from '../../encounters/dto/complete-encounter.dto';

describe('DTO Validation — Encounter', () => {
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
