'use client';

import { RespuestaTratamientoData } from '@/types';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import { SectionBlock, SectionFieldHeader, SectionIntro } from '@/components/sections/SectionPrimitives';

interface Props {
  data: RespuestaTratamientoData;
  onChange: (data: RespuestaTratamientoData) => void;
  readOnly?: boolean;
}

export default function RespuestaTratamientoSection({ data, onChange, readOnly }: Props) {
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-5">
      <SectionIntro description="Documenta respuesta clínica, resultados disponibles y próximos pasos tras el tratamiento indicado." />

      <SectionBlock title="Respuesta clínica" description="Evolución del paciente y resultados objetivos posteriores al tratamiento.">
        <div className="space-y-4">
          <div>
            <SectionFieldHeader
              label="Evolución con el tratamiento"
              action={!readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) => handleChange('evolucion', `${data.evolucion ? `${data.evolucion} ` : ''}${text}`.trim())}
                />
              ) : undefined}
            />
            <textarea
              value={data.evolucion || ''}
              onChange={(e) => handleChange('evolucion', e.target.value)}
              disabled={readOnly}
              rows={4}
              className="form-input resize-none"
              placeholder="Describa cómo ha respondido el paciente al tratamiento indicado..."
            />
          </div>

          <div>
            <SectionFieldHeader
              label="Resultados de exámenes"
              action={!readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) =>
                    handleChange('resultadosExamenes', `${data.resultadosExamenes ? `${data.resultadosExamenes} ` : ''}${text}`.trim())
                  }
                />
              ) : undefined}
            />
            <textarea
              value={data.resultadosExamenes || ''}
              onChange={(e) => handleChange('resultadosExamenes', e.target.value)}
              disabled={readOnly}
              rows={3}
              className="form-input resize-none"
              placeholder="Resultados relevantes de exámenes solicitados..."
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Ajustes y seguimiento" description="Modificaciones al plan inicial y continuidad asistencial.">
        <div className="space-y-4">
          <div>
            <SectionFieldHeader
              label="Ajustes al tratamiento"
              action={!readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) =>
                    handleChange('ajustesTratamiento', `${data.ajustesTratamiento ? `${data.ajustesTratamiento} ` : ''}${text}`.trim())
                  }
                />
              ) : undefined}
            />
            <textarea
              value={data.ajustesTratamiento || ''}
              onChange={(e) => handleChange('ajustesTratamiento', e.target.value)}
              disabled={readOnly}
              rows={3}
              className="form-input resize-none"
              placeholder="Cambios realizados al plan de tratamiento inicial..."
            />
          </div>

          <div>
            <SectionFieldHeader
              label="Plan de seguimiento"
              action={!readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) =>
                    handleChange('planSeguimiento', `${data.planSeguimiento ? `${data.planSeguimiento} ` : ''}${text}`.trim())
                  }
                />
              ) : undefined}
            />
            <textarea
              value={data.planSeguimiento || ''}
              onChange={(e) => handleChange('planSeguimiento', e.target.value)}
              disabled={readOnly}
              rows={3}
              className="form-input resize-none"
              placeholder="Próximos controles, indicaciones de seguimiento..."
            />
          </div>
        </div>
      </SectionBlock>
    </div>
  );
}
