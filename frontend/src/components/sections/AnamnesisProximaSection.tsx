'use client';

import { AnamnesisProximaData } from '@/types';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import { SectionBlock, SectionFieldHeader } from '@/components/sections/SectionPrimitives';

interface Props {
  data: AnamnesisProximaData;
  onChange: (data: AnamnesisProximaData) => void;
  readOnly?: boolean;
}

export default function AnamnesisProximaSection({ data, onChange, readOnly }: Props) {
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-5">
      <SectionBlock title="Relato del cuadro actual">
        <SectionFieldHeader
          label="Relato ampliado"
          action={!readOnly ? (
            <VoiceDictationButton
              onTranscript={(text) =>
                handleChange('relatoAmpliado', `${data.relatoAmpliado ? `${data.relatoAmpliado} ` : ''}${text}`.trim())
              }
            />
          ) : undefined}
        />
        <textarea
          value={data.relatoAmpliado || ''}
          onChange={(e) => handleChange('relatoAmpliado', e.target.value)}
          disabled={readOnly}
          rows={4}
          className="form-input form-textarea"
          placeholder=""
        />
      </SectionBlock>

      <SectionBlock title="Cronología y moduladores">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Inicio</label>
              <input
                type="text"
                value={data.inicio || ''}
                onChange={(e) => handleChange('inicio', e.target.value)}
                disabled={readOnly}
                className="form-input"
                placeholder="Ej: Hace 3 días, súbito"
              />
            </div>
            <div>
              <label className="form-label">Evolución</label>
              <input
                type="text"
                value={data.evolucion || ''}
                onChange={(e) => handleChange('evolucion', e.target.value)}
                disabled={readOnly}
                className="form-input"
                placeholder="Ej: Progresivo, intermitente"
              />
            </div>
          </div>

          <div>
            <SectionFieldHeader
              label="Factores agravantes"
              action={!readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) =>
                    handleChange('factoresAgravantes', `${data.factoresAgravantes ? `${data.factoresAgravantes} ` : ''}${text}`.trim())
                  }
                />
              ) : undefined}
            />
            <textarea
              value={data.factoresAgravantes || ''}
              onChange={(e) => handleChange('factoresAgravantes', e.target.value)}
              disabled={readOnly}
              rows={2}
              className="form-input form-textarea"
              placeholder="¿Qué empeora los síntomas?"
            />
          </div>

          <div>
            <SectionFieldHeader
              label="Factores atenuantes"
              action={!readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) =>
                    handleChange('factoresAtenuantes', `${data.factoresAtenuantes ? `${data.factoresAtenuantes} ` : ''}${text}`.trim())
                  }
                />
              ) : undefined}
            />
            <textarea
              value={data.factoresAtenuantes || ''}
              onChange={(e) => handleChange('factoresAtenuantes', e.target.value)}
              disabled={readOnly}
              rows={2}
              className="form-input form-textarea"
              placeholder="¿Qué mejora los síntomas?"
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Síntomas asociados">
        <SectionFieldHeader
          label="Síntomas asociados"
          action={!readOnly ? (
            <VoiceDictationButton
              onTranscript={(text) =>
                handleChange('sintomasAsociados', `${data.sintomasAsociados ? `${data.sintomasAsociados} ` : ''}${text}`.trim())
              }
            />
          ) : undefined}
        />
        <textarea
          value={data.sintomasAsociados || ''}
          onChange={(e) => handleChange('sintomasAsociados', e.target.value)}
          disabled={readOnly}
          rows={3}
          className="form-input form-textarea"
          placeholder=""
        />
      </SectionBlock>
    </div>
  );
}
