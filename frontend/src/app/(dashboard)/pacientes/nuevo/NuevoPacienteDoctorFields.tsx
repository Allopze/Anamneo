import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { CalculatedAge } from '@/lib/date';
import LocalizedDateInput from '@/components/common/LocalizedDateInput';
import type { PatientForm } from './nuevo.constants';

type Props = {
  register: UseFormRegister<PatientForm>;
  errors: FieldErrors<PatientForm>;
  todayDateValue: string;
  fechaNacimiento: string | undefined;
  edadCalculada: CalculatedAge | null;
  onFechaNacimientoChange: (value: string) => void;
};

export default function NuevoPacienteDoctorFields({
  register,
  errors,
  todayDateValue,
  fechaNacimiento,
  edadCalculada,
  onFechaNacimientoChange,
}: Props) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <div>
          <label htmlFor="fechaNacimiento" className="form-label">
            Fecha de nacimiento *
          </label>
          <input type="hidden" {...register('fechaNacimiento')} />
          <LocalizedDateInput
            id="fechaNacimiento"
            value={fechaNacimiento}
            onChange={onFechaNacimientoChange}
            max={todayDateValue}
            className={`form-input ${errors.fechaNacimiento ? 'form-input-error' : ''}`}
            autoComplete="bday"
            aria-invalid={Boolean(errors.fechaNacimiento)}
            aria-describedby={errors.fechaNacimiento ? 'fechaNacimiento-error' : undefined}
          />
          {errors.fechaNacimiento && <p id="fechaNacimiento-error" className="form-error">{errors.fechaNacimiento.message}</p>}
        </div>
        <div>
          <label htmlFor="edadCalculada" className="form-label">
            Edad calculada
          </label>
          <div
            id="edadCalculada"
            role="status"
            className="form-input flex min-h-[50px] items-center bg-surface-muted/30 leading-5 text-ink-secondary"
          >
            {edadCalculada
              ? `${edadCalculada.edad} años ${edadCalculada.edadMeses} meses`
              : 'Pendiente de fecha de nacimiento'}
          </div>
        </div>
        <div>
          <label htmlFor="sexo" className="form-label">
            Sexo *
          </label>
          <select
            id="sexo"
            className={`form-input ${errors.sexo ? 'form-input-error' : ''}`}
            {...register('sexo')}
          >
            <option value="" disabled>Seleccione...</option>
            <option value="MASCULINO">Masculino</option>
            <option value="FEMENINO">Femenino</option>
            <option value="OTRO">Otro</option>
            <option value="PREFIERE_NO_DECIR">Prefiere no decir</option>
          </select>
          {errors.sexo && <p className="form-error">{errors.sexo.message}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="prevision" className="form-label">
          Previsión de salud *
        </label>
        <select
          id="prevision"
          className={`form-input ${errors.prevision ? 'form-input-error' : ''}`}
          {...register('prevision')}
        >
          <option value="" disabled>Seleccione...</option>
          <option value="FONASA">FONASA</option>
          <option value="ISAPRE">ISAPRE</option>
          <option value="OTRA">Otra</option>
          <option value="DESCONOCIDA">Desconocida</option>
        </select>
        {errors.prevision && <p className="form-error">{errors.prevision.message}</p>}
      </div>

      <div>
        <label htmlFor="trabajo" className="form-label">
          Trabajo / Ocupación
        </label>
        <input
          id="trabajo"
          type="text"
          className="form-input"
          placeholder="Ej: Ingeniero"
          {...register('trabajo')}
        />
      </div>

      <div>
        <label htmlFor="domicilio" className="form-label">
          Domicilio
        </label>
        <input
          id="domicilio"
          type="text"
          className="form-input"
          placeholder="Ej: Av. Providencia 1234, Santiago"
          {...register('domicilio')}
        />
      </div>

      <div>
        <label htmlFor="centroMedico" className="form-label">
          Centro médico
        </label>
        <input
          id="centroMedico"
          type="text"
          className="form-input"
          placeholder="Ej: Hospital Clínico UC, Clínica Santa María"
          {...register('centroMedico')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="telefono" className="form-label">
            Teléfono
          </label>
          <input
            id="telefono"
            type="tel"
            className={`form-input ${errors.telefono ? 'form-input-error' : ''}`}
            placeholder="Ej: +56 9 1234 5678"
            {...register('telefono')}
          />
          {errors.telefono && <p className="form-error">{errors.telefono.message}</p>}
        </div>

        <div>
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={`form-input ${errors.email ? 'form-input-error' : ''}`}
            placeholder="Ej: paciente@correo.cl"
            {...register('email')}
          />
          {errors.email && <p className="form-error">{errors.email.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="contactoEmergenciaNombre" className="form-label">
            Contacto de emergencia
          </label>
          <input
            id="contactoEmergenciaNombre"
            type="text"
            className={`form-input ${errors.contactoEmergenciaNombre ? 'form-input-error' : ''}`}
            placeholder="Ej: Ana Pérez"
            {...register('contactoEmergenciaNombre')}
          />
          {errors.contactoEmergenciaNombre && (
            <p className="form-error">{errors.contactoEmergenciaNombre.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="contactoEmergenciaTelefono" className="form-label">
            Teléfono de emergencia
          </label>
          <input
            id="contactoEmergenciaTelefono"
            type="tel"
            className={`form-input ${errors.contactoEmergenciaTelefono ? 'form-input-error' : ''}`}
            placeholder="Ej: +56 9 8765 4321"
            {...register('contactoEmergenciaTelefono')}
          />
          {errors.contactoEmergenciaTelefono && (
            <p className="form-error">{errors.contactoEmergenciaTelefono.message}</p>
          )}
        </div>
      </div>

      {edadCalculada && edadCalculada.edad < 18 && (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <header className="mb-3">
            <p className="text-xs font-semibold text-amber-800">
              Ley 21.719 Art. 16 quáter — Representante legal del NNA
            </p>
            <p className="mt-1 text-xs text-amber-900">
              Paciente menor de 18 años. Para tratamientos sobre datos sensibles
              {edadCalculada.edad < 14 ? ' (y todo tratamiento)' : ' de menores de 16'} se requiere
              consentimiento de padre, madre, tutor o representante legal.
            </p>
          </header>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="legalRepresentativeName" className="form-label">
                Nombre del representante legal
              </label>
              <input
                id="legalRepresentativeName"
                type="text"
                className="form-input"
                placeholder="Nombre completo"
                {...register('legalRepresentativeName')}
              />
            </div>
            <div>
              <label htmlFor="legalRepresentativeRut" className="form-label">
                RUT del representante
              </label>
              <input
                id="legalRepresentativeRut"
                type="text"
                className="form-input"
                placeholder="12.345.678-9"
                {...register('legalRepresentativeRut')}
              />
            </div>
            <div>
              <label htmlFor="legalRepresentativeRelationship" className="form-label">
                Parentesco / vínculo
              </label>
              <select
                id="legalRepresentativeRelationship"
                className="form-input"
                {...register('legalRepresentativeRelationship')}
              >
                <option value="">— Seleccionar —</option>
                <option value="PADRE">Padre</option>
                <option value="MADRE">Madre</option>
                <option value="TUTOR">Tutor legal</option>
                <option value="REPRESENTANTE">Otro representante legal</option>
              </select>
            </div>
            <div>
              <label htmlFor="legalRepresentativeContact" className="form-label">
                Contacto del representante (email o teléfono)
              </label>
              <input
                id="legalRepresentativeContact"
                type="text"
                className="form-input"
                placeholder="email o teléfono"
                {...register('legalRepresentativeContact')}
              />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
