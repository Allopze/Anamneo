'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Encounter, SECTION_LABELS, SEXO_LABELS, PREVISION_LABELS, STATUS_LABELS } from '@/types';
import { FiArrowLeft, FiFileText, FiPrinter, FiDownload } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';

export default function FichaClinicaPage() {
  const { id } = useParams<{ id: string }>();

  const { data: encounter, isLoading } = useQuery({
    queryKey: ['encounter', id],
    queryFn: async () => {
      const response = await api.get(`/encounters/${id}`);
      return response.data as Encounter;
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await api.get(`/encounters/${id}/export/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ficha_clinica_${(id as string).slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al generar el PDF');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!encounter) {
    return (
      <div className="text-center py-12">
        <p>Atención no encontrada</p>
      </div>
    );
  }

  const sections = encounter.sections || [];
  const identificacion = sections.find((s) => s.sectionKey === 'IDENTIFICACION')?.data || {};
  const motivoConsulta = sections.find((s) => s.sectionKey === 'MOTIVO_CONSULTA')?.data || {};
  const anamnesisProxima = sections.find((s) => s.sectionKey === 'ANAMNESIS_PROXIMA')?.data || {};
  const anamnesisRemota = sections.find((s) => s.sectionKey === 'ANAMNESIS_REMOTA')?.data || {};
  const revisionSistemas = sections.find((s) => s.sectionKey === 'REVISION_SISTEMAS')?.data || {};
  const examenFisico = sections.find((s) => s.sectionKey === 'EXAMEN_FISICO')?.data || {};
  const sospechaDiagnostica = sections.find((s) => s.sectionKey === 'SOSPECHA_DIAGNOSTICA')?.data || {};
  const tratamiento = sections.find((s) => s.sectionKey === 'TRATAMIENTO')?.data || {};
  const respuestaTratamiento = sections.find((s) => s.sectionKey === 'RESPUESTA_TRATAMIENTO')?.data || {};
  const observaciones = sections.find((s) => s.sectionKey === 'OBSERVACIONES')?.data || {};

  return (
    <>
      {/* Print controls - hidden when printing */}
      <div className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Link
            href={`/atenciones/${id}`}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <FiArrowLeft className="w-5 h-5" />
            {encounter?.status === 'COMPLETADO' ? 'Volver al resumen' : 'Volver a edición'}
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadPdf} className="btn btn-secondary flex items-center gap-2">
              <FiDownload className="w-4 h-4" />
              Descargar PDF
            </button>
            <button onClick={handlePrint} className="btn btn-primary flex items-center gap-2">
              <FiPrinter className="w-4 h-4" />
              Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* Clinical record content */}
      <div className="max-w-4xl mx-auto p-8 bg-white print:p-0">
        {/* Header */}
        <header className="text-center border-b-2 border-slate-900 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-slate-900">FICHA CLÍNICA</h1>
          <p className="text-slate-600">
            Fecha: {format(new Date(encounter.createdAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
          </p>
        </header>

        {/* Patient identification */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mb-3">
            1. IDENTIFICACIÓN DEL PACIENTE
          </h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <p><strong>Nombre:</strong> {identificacion.nombre || '-'}</p>
            <p><strong>RUT:</strong> {identificacion.rut || 'Sin RUT'}</p>
            <p><strong>Edad:</strong> {identificacion.edad} años</p>
            <p><strong>Sexo:</strong> {SEXO_LABELS[identificacion.sexo] || '-'}</p>
            <p><strong>Previsión:</strong> {PREVISION_LABELS[identificacion.prevision] || '-'}</p>
            <p><strong>Trabajo:</strong> {identificacion.trabajo || '-'}</p>
            <p className="col-span-2"><strong>Domicilio:</strong> {identificacion.domicilio || '-'}</p>
          </div>
        </section>

        {/* Motivo de consulta */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mb-3">
            2. MOTIVO DE CONSULTA
          </h2>
          <p className="text-sm whitespace-pre-wrap">{motivoConsulta.texto || '-'}</p>
          {motivoConsulta.afeccionSeleccionada && (
            <p className="text-sm mt-2 text-slate-600">
              <strong>Afección probable:</strong> {motivoConsulta.afeccionSeleccionada.name}
            </p>
          )}
        </section>

        {/* Anamnesis próxima */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mb-3">
            3. ANAMNESIS PRÓXIMA
          </h2>
          <div className="text-sm space-y-2">
            {anamnesisProxima.relatoAmpliado && (
              <p><strong>Relato:</strong> {anamnesisProxima.relatoAmpliado}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {anamnesisProxima.inicio && <p><strong>Inicio:</strong> {anamnesisProxima.inicio}</p>}
              {anamnesisProxima.evolucion && <p><strong>Evolución:</strong> {anamnesisProxima.evolucion}</p>}
            </div>
            {anamnesisProxima.factoresAgravantes && (
              <p><strong>Factores agravantes:</strong> {anamnesisProxima.factoresAgravantes}</p>
            )}
            {anamnesisProxima.factoresAtenuantes && (
              <p><strong>Factores atenuantes:</strong> {anamnesisProxima.factoresAtenuantes}</p>
            )}
            {anamnesisProxima.sintomasAsociados && (
              <p><strong>Síntomas asociados:</strong> {anamnesisProxima.sintomasAsociados}</p>
            )}
          </div>
        </section>

        {/* Anamnesis remota */}
        <section className="mb-6 print-break-before">
          <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mb-3">
            4. ANAMNESIS REMOTA
          </h2>
          <div className="text-sm space-y-1">
            {Object.entries({
              antecedentesMedicos: 'Antecedentes médicos',
              antecedentesQuirurgicos: 'Antecedentes quirúrgicos',
              antecedentesGinecoobstetricos: 'Antecedentes ginecoobstétricos',
              antecedentesFamiliares: 'Antecedentes familiares',
              habitos: 'Hábitos',
              medicamentos: 'Medicamentos',
              alergias: 'Alergias',
              inmunizaciones: 'Inmunizaciones',
            }).map(([key, label]) => {
              const value = anamnesisRemota[key];
              const text = typeof value === 'object' ? value?.texto : value;
              return text ? (
                <p key={key}><strong>{label}:</strong> {text}</p>
              ) : null;
            })}
          </div>
        </section>

        {/* Examen físico */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mb-3">
            5. REVISIÓN POR SISTEMAS
          </h2>
          <div className="text-sm space-y-1">
            {Object.entries(revisionSistemas).length > 0 ? (
              Object.entries(revisionSistemas).map(([key, value]) => {
                const text = typeof value === 'object' && value !== null ? (value as any).texto || (value as any).observaciones : value;
                return text ? (
                  <p key={key}><strong>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}:</strong> {String(text)}</p>
                ) : null;
              })
            ) : (
              <p>-</p>
            )}
          </div>
        </section>

        {/* Examen físico */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mb-3">
            6. EXAMEN FÍSICO
          </h2>
          <div className="text-sm">
            {examenFisico.signosVitales && (
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
            )}
            <div className="space-y-1">
              {examenFisico.cabeza && <p><strong>Cabeza:</strong> {examenFisico.cabeza}</p>}
              {examenFisico.cuello && <p><strong>Cuello:</strong> {examenFisico.cuello}</p>}
              {examenFisico.torax && <p><strong>Tórax:</strong> {examenFisico.torax}</p>}
              {examenFisico.abdomen && <p><strong>Abdomen:</strong> {examenFisico.abdomen}</p>}
              {examenFisico.extremidades && <p><strong>Extremidades:</strong> {examenFisico.extremidades}</p>}
            </div>
          </div>
        </section>

        {/* Sospecha diagnóstica */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mb-3">
            7. SOSPECHA DIAGNÓSTICA
          </h2>
          {sospechaDiagnostica.sospechas?.length > 0 ? (
            <ol className="list-decimal list-inside text-sm space-y-1">
              {sospechaDiagnostica.sospechas.map((s: any, i: number) => (
                <li key={i}>
                  <strong>{s.diagnostico}</strong>
                  {s.notas && <span className="text-slate-600"> - {s.notas}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm">-</p>
          )}
        </section>

        {/* Tratamiento */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mb-3">
            8. TRATAMIENTO
          </h2>
          <div className="text-sm space-y-2">
            {tratamiento.plan && <p><strong>Plan:</strong> {tratamiento.plan}</p>}
            {tratamiento.indicaciones && <p><strong>Indicaciones:</strong> {tratamiento.indicaciones}</p>}
            {tratamiento.receta && <p><strong>Receta:</strong> {tratamiento.receta}</p>}
            {tratamiento.examenes && <p><strong>Exámenes:</strong> {tratamiento.examenes}</p>}
            {tratamiento.derivaciones && <p><strong>Derivaciones:</strong> {tratamiento.derivaciones}</p>}
          </div>
        </section>

        {/* Respuesta al tratamiento */}
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mb-3">
            9. RESPUESTA AL TRATAMIENTO
          </h2>
          <div className="text-sm space-y-2">
            {respuestaTratamiento.evolucion && <p><strong>Evolución:</strong> {respuestaTratamiento.evolucion}</p>}
            {respuestaTratamiento.resultadosExamenes && <p><strong>Resultados de exámenes:</strong> {respuestaTratamiento.resultadosExamenes}</p>}
            {respuestaTratamiento.ajustesTratamiento && <p><strong>Ajustes al tratamiento:</strong> {respuestaTratamiento.ajustesTratamiento}</p>}
            {respuestaTratamiento.planSeguimiento && <p><strong>Plan de seguimiento:</strong> {respuestaTratamiento.planSeguimiento}</p>}
            {!respuestaTratamiento.evolucion && !respuestaTratamiento.resultadosExamenes && !respuestaTratamiento.ajustesTratamiento && !respuestaTratamiento.planSeguimiento && (
              <p>-</p>
            )}
          </div>
        </section>

        {/* Observaciones */}
        {observaciones.observaciones && (
          <section className="mb-6">
            <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mb-3">
              10. OBSERVACIONES
            </h2>
            <p className="text-sm whitespace-pre-wrap">{observaciones.observaciones}</p>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-slate-300">
          <div className="flex justify-between text-sm">
            <p>
              <strong>Profesional:</strong> {encounter.createdBy?.nombre || '-'}
            </p>
            <p>
              <strong>Estado:</strong> {STATUS_LABELS[encounter.status]}
            </p>
          </div>
          <div className="mt-8 flex justify-end">
            <div className="text-center">
              <div className="w-48 border-t border-slate-900 pt-1">
                <p className="text-sm">Firma y Timbre</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
