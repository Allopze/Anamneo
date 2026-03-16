'use client';

import { ObservacionesData } from '@/types';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import { SectionBlock, SectionCallout, SectionFieldHeader, SectionIntro } from '@/components/sections/SectionPrimitives';

interface Props {
  data: ObservacionesData;
  onChange: (data: ObservacionesData) => void;
  readOnly?: boolean;
}

export default function ObservacionesSection({ data, onChange, readOnly }: Props) {
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-5">
      <SectionIntro description="Cierra la atención con observaciones clínicas finales y, si hace falta, notas internas para el equipo." />

      <SectionBlock title="Observaciones generales" description="Información adicional útil para el registro clínico o la lectura posterior de la atención.">
        <SectionFieldHeader
          label="Observaciones generales"
          action={!readOnly ? (
            <VoiceDictationButton
              onTranscript={(text) =>
                handleChange('observaciones', `${data.observaciones ? `${data.observaciones} ` : ''}${text}`.trim())
              }
            />
          ) : undefined}
        />
        <textarea
          value={data.observaciones || ''}
          onChange={(e) => handleChange('observaciones', e.target.value)}
          disabled={readOnly}
          rows={6}
          className="form-input resize-none"
          placeholder="Cualquier observación adicional relevante para el registro..."
        />
      </SectionBlock>

      <SectionBlock title="Notas internas" description="Notas operativas o recordatorios del equipo que no deben salir en la ficha impresa.">
        <SectionFieldHeader
          label="Notas internas"
          action={!readOnly ? (
            <VoiceDictationButton
              onTranscript={(text) =>
                handleChange('notasInternas', `${data.notasInternas ? `${data.notasInternas} ` : ''}${text}`.trim())
              }
            />
          ) : undefined}
        />
        <textarea
          value={data.notasInternas || ''}
          onChange={(e) => handleChange('notasInternas', e.target.value)}
          disabled={readOnly}
          rows={3}
          className="form-input resize-none"
          placeholder="Notas de uso interno, recordatorios para el equipo médico..."
        />
        <div className="mt-3">
          <SectionCallout tone="warning">
            <p className="text-xs">
              Estas notas no se incluirán en la ficha clínica exportada a PDF.
            </p>
          </SectionCallout>
        </div>
      </SectionBlock>
    </div>
  );
}
