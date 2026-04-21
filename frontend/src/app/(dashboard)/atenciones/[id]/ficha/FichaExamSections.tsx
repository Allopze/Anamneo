import { ESTADO_GENERAL_LABELS } from './ficha.constants';

export function PhysicalExamSection({ examenFisico }: { examenFisico: any }) {
  return (
    <section className="mb-8">
      <h2 className="ficha-section-heading">6. Examen físico</h2>
      <div className="text-sm">
        {(examenFisico.estadoGeneral || examenFisico.estadoGeneralNotas) ? (
          <div className="mb-3">
            <strong>Estado general:</strong>
            <span className="ml-2">
              {[ESTADO_GENERAL_LABELS[examenFisico.estadoGeneral as string] || examenFisico.estadoGeneral, examenFisico.estadoGeneralNotas].filter(Boolean).join(' · ')}
            </span>
          </div>
        ) : null}
        {examenFisico.signosVitales ? (
          <div className="mb-3">
            <strong>Signos vitales:</strong>
            <span className="ml-2">
              PA: {examenFisico.signosVitales.presionArterial || '-'} |
              FC: {examenFisico.signosVitales.frecuenciaCardiaca || '-'} lpm |
              FR: {examenFisico.signosVitales.frecuenciaRespiratoria || '-'} rpm |
              T°: {examenFisico.signosVitales.temperatura || '-'}°C |
              SatO2: {examenFisico.signosVitales.saturacionOxigeno || '-'}% |
              Peso: {examenFisico.signosVitales.peso || '-'} kg |
              Talla: {examenFisico.signosVitales.talla || '-'} cm |
              IMC: {examenFisico.signosVitales.imc || '-'}
            </span>
          </div>
        ) : null}
        <div className="space-y-1">
          {examenFisico.cabeza ? <p><strong>Cabeza:</strong> {examenFisico.cabeza}</p> : null}
          {examenFisico.cuello ? <p><strong>Cuello:</strong> {examenFisico.cuello}</p> : null}
          {examenFisico.torax ? <p><strong>Tórax:</strong> {examenFisico.torax}</p> : null}
          {examenFisico.abdomen ? <p><strong>Abdomen:</strong> {examenFisico.abdomen}</p> : null}
          {examenFisico.extremidades ? <p><strong>Extremidades:</strong> {examenFisico.extremidades}</p> : null}
        </div>
      </div>
    </section>
  );
}

export function DiagnosticAssessmentSection({ sospechaDiagnostica }: { sospechaDiagnostica: any }) {
  return (
    <section className="mb-8">
      <h2 className="ficha-section-heading">7. Sospecha diagnóstica</h2>
      {sospechaDiagnostica.sospechas?.length > 0 ? (
        <ol className="list-decimal list-inside text-sm space-y-1">
          {sospechaDiagnostica.sospechas.map((item: any, index: number) => (
            <li key={index}>
              <strong>{item.diagnostico}</strong>
              {item.codigoCie10 ? <span className="text-ink-secondary"> ({item.codigoCie10})</span> : null}
              {item.descripcionCie10 ? <span className="text-ink-secondary"> · {item.descripcionCie10}</span> : null}
              {item.notas ? <span className="text-ink-secondary"> - {item.notas}</span> : null}
            </li>
          ))}
        </ol>
      ) : <p className="text-sm">-</p>}
    </section>
  );
}
