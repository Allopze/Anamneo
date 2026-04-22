import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePatientQuickDto } from '../../patients/dto/create-patient-quick.dto';
import { UpdatePatientHistoryDto } from '../../patients/dto/update-patient-history.dto';
import { UpdatePatientTaskStatusDto } from '../../patients/dto/update-patient-task-status.dto';

describe('DTO Validation — Patient', () => {
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
});
