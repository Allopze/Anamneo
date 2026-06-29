import { z } from 'zod';

export const profileSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  email: z.string().email('Email inválido').max(255),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Requerido'),
    newPassword: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .max(72, 'Máximo 72 caracteres')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Debe contener mayúscula, minúscula y número')
      .regex(/^\S+$/, 'No puede contener espacios'),
    confirmPassword: z.string().min(1, 'Requerido'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type ProfileForm = z.infer<typeof profileSchema>;
export type PasswordForm = z.infer<typeof passwordSchema>;
export type AjustesTab = 'perfil' | 'centro' | 'correo' | 'sistema';
