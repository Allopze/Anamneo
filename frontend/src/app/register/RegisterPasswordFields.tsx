import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { FiEye, FiEyeOff, FiLock } from 'react-icons/fi';
import type { RegisterForm } from './register.constants';

type RegisterPasswordFieldsProps = {
  disabled: boolean;
  errors: FieldErrors<RegisterForm>;
  setShowConfirmPassword: (value: boolean) => void;
  setShowPassword: (value: boolean) => void;
  showConfirmPassword: boolean;
  showPassword: boolean;
  register: UseFormRegister<RegisterForm>;
};

export default function RegisterPasswordFields({
  disabled,
  errors,
  setShowConfirmPassword,
  setShowPassword,
  showConfirmPassword,
  showPassword,
  register,
}: RegisterPasswordFieldsProps) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <label htmlFor="password" className="form-label">
          Contraseña
        </label>
        <div className="relative">
          <FiLock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            {...register('password')}
            disabled={disabled}
            className={`form-input pl-10 pr-10 ${errors.password ? 'form-input-error' : ''}`}
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby="password-help password-error"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-ink-secondary"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
          </button>
        </div>
        {errors.password ? (
          <p id="password-error" className="form-error" role="alert">
            {errors.password.message}
          </p>
        ) : null}
        <p id="password-help" className="mt-1 text-micro text-ink-muted">
          Mínimo 8 caracteres, una mayúscula, una minúscula y un número.
        </p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="form-label">
          Confirmar contraseña
        </label>
        <div className="relative">
          <FiLock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            {...register('confirmPassword')}
            disabled={disabled}
            className={`form-input pl-10 pr-10 ${errors.confirmPassword ? 'form-input-error' : ''}`}
            placeholder="••••••••"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-ink-secondary"
            aria-label={showConfirmPassword ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
          >
            {showConfirmPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
          </button>
        </div>
        {errors.confirmPassword ? (
          <p id="confirm-password-error" className="form-error" role="alert">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
