import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from '../../auth/dto/register.dto';
import { LoginDto } from '../../auth/dto/login.dto';
import { ChangePasswordDto } from '../../auth/dto/change-password.dto';

describe('DTO Validation — Auth', () => {
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
});
