import type { AjustesHook } from './useAjustes';

type Props = Pick<AjustesHook, 'clinic' | 'setClinic' | 'clinicMutation'>;

export default function ClinicTab({ clinic, setClinic, clinicMutation }: Props) {
  return (
    <div role="tabpanel" id="tabpanel-centro" aria-labelledby="tab-centro">
      <div className="card mb-6 border-accent/20">
        <div className="panel-header">
          <h2 className="panel-title">Datos del centro médico</h2>
        </div>
        <p className="text-sm text-ink-muted mb-4">
          Esta información se usa en fichas impresas, exportaciones y como fallback para los correos enviados por el
          sistema.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="clinic-name" className="block text-sm font-medium text-ink-secondary mb-1">
              Nombre del centro
            </label>
            <input
              id="clinic-name"
              type="text"
              className="input w-full"
              value={clinic.clinicName}
              onChange={(e) => setClinic((c) => ({ ...c, clinicName: e.target.value }))}
              placeholder="Ej: Centro Médico San Pablo"
            />
          </div>
          <div>
            <label htmlFor="clinic-address" className="block text-sm font-medium text-ink-secondary mb-1">
              Dirección
            </label>
            <input
              id="clinic-address"
              type="text"
              className="input w-full"
              value={clinic.clinicAddress}
              onChange={(e) => setClinic((c) => ({ ...c, clinicAddress: e.target.value }))}
              placeholder="Ej: Av. Providencia 1234, Santiago"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="clinic-phone" className="block text-sm font-medium text-ink-secondary mb-1">
                Teléfono
              </label>
              <input
                id="clinic-phone"
                type="text"
                className="input w-full"
                value={clinic.clinicPhone}
                onChange={(e) => setClinic((c) => ({ ...c, clinicPhone: e.target.value }))}
                placeholder="+56 2 1234 5678"
              />
            </div>
            <div>
              <label htmlFor="clinic-email" className="block text-sm font-medium text-ink-secondary mb-1">
                Email
              </label>
              <input
                id="clinic-email"
                type="email"
                className="input w-full"
                value={clinic.clinicEmail}
                onChange={(e) => setClinic((c) => ({ ...c, clinicEmail: e.target.value }))}
                placeholder="contacto@centro.cl"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => clinicMutation.mutate()}
            disabled={clinicMutation.isPending}
            className="btn btn-primary"
          >
            {clinicMutation.isPending ? 'Guardando...' : 'Guardar datos del centro'}
          </button>
        </div>
      </div>
    </div>
  );
}
