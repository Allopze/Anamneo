import { z } from 'zod';
import { FiClipboard, FiFileText, FiLock, FiShield, FiUserPlus, FiUsers } from 'react-icons/fi';

export const REGISTER_DRAFT_KEY = 'anamneo:draft:register';

export type RegisterRole = 'ADMIN' | 'MEDICO' | 'ASISTENTE';

export const ROLE_OPTIONS: Record<RegisterRole, { label: string; description: string }> = {
  ADMIN: {
    label: 'Administrador',
    description: 'Acceso administrativo completo del sistema',
  },
  MEDICO: {
    label: 'Médico',
    description: 'Atención clínica, atenciones y pacientes',
  },
  ASISTENTE: {
    label: 'Asistente',
    description: 'Apoyo clínico y gestión operativa',
  },
};

export const registerSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Ingrese un email válido'),
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña no puede exceder 72 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/^\S+$/, 'La contraseña no puede contener espacios'),
  confirmPassword: z.string(),
  role: z.enum(['ADMIN', 'MEDICO', 'ASISTENTE']),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export type RegisterForm = z.infer<typeof registerSchema>;

export const REGISTER_BOOTSTRAP_CHIPS = [
  { icon: <FiShield className="h-3.5 w-3.5" />, label: 'Admin inicial' },
  { icon: <FiUsers className="h-3.5 w-3.5" />, label: 'Gestión de equipo' },
  { icon: <FiClipboard className="h-3.5 w-3.5" />, label: 'Flujo clínico' },
];

export const REGISTER_INVITATION_CHIPS = [
  { icon: <FiUserPlus className="h-3.5 w-3.5" />, label: 'Invitación' },
  { icon: <FiShield className="h-3.5 w-3.5" />, label: 'Rol asignado' },
  { icon: <FiFileText className="h-3.5 w-3.5" />, label: 'Trazabilidad' },
];
