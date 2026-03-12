import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from '../../auth/dto/register.dto';
import { LoginDto } from '../../auth/dto/login.dto';
import { CreatePatientQuickDto } from '../../patients/dto/create-patient-quick.dto';
import { UpdateSectionDto } from '../../encounters/dto/update-section.dto';
import { ChangePasswordDto } from '../../auth/dto/change-password.dto';

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

    it('should reject ADMIN role', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'Password1',
        nombre: 'Test User',
        role: 'ADMIN',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'role')).toBe(true);
    });

    it('should accept MEDICO role only', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'Password1',
        nombre: 'Test User',
        role: 'MEDICO',
      });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'role').length).toBe(0);
    });

    it('should reject ASISTENTE role', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'Password1',
        nombre: 'Test User',
        role: 'ASISTENTE',
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
  });

  describe('UpdateSectionDto', () => {
    it('should pass with valid data object', async () => {
      const dto = plainToInstance(UpdateSectionDto, {
        data: { motivo: 'dolor de cabeza' },
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

    it('should accept completed as optional', async () => {
      const dto = plainToInstance(UpdateSectionDto, {
        data: { motivo: 'dolor' },
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
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

    it('should fail with short new password', async () => {
      const dto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'OldPass1',
        newPassword: 'Ab1',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
    });
  });
});
