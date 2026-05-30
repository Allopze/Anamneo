'use client';

import { Attachment, HistoryFieldValue, SospechaDiagnosticaData, TratamientoData } from '@/types';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import {
  SectionBlock,
  SectionCallout,
  SectionFieldHeader,
} from '@/components/sections/SectionPrimitives';
import StructuredMedicationsEditor from '@/components/sections/StructuredMedicationsEditor';
import TreatmentDiagnosisSelect, { type TreatmentDiagnosisOption } from '@/components/sections/TreatmentDiagnosisSelect';
import { StructuredOrderBlock } from './TratamientoSection.parts';

interface Props {
  data: TratamientoData;
  onChange: (data: TratamientoData) => void;
  readOnly?: boolean;
  linkedAttachmentsByOrderId?: Record<string, Attachment[]>;
  onRequestAttachToOrder?: (type: 'EXAMEN' | 'DERIVACION', orderId: string) => void;
  onPreviewAttachment?: (attachment: Attachment) => void;
  allergyData?: HistoryFieldValue | string;
  diagnosticData?: SospechaDiagnosticaData;
}

export default function TratamientoSection({
  data,
  onChange,
  readOnly,
  linkedAttachmentsByOrderId,
  onRequestAttachToOrder,
  onPreviewAttachment,
  allergyData,
  diagnosticData,
}: Props) {
  const createId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const medicamentos = data.medicamentosEstructurados || [];
  const examenes = data.examenesEstructurados || [];
  const derivaciones = data.derivacionesEstructuradas || [];

  const diagnosticOptions: TreatmentDiagnosisOption[] = (diagnosticData?.sospechas || [])
    .map((entry) => {
      const sourceLabel =
        entry.diagnostico?.trim() ||
        entry.descripcionCie10?.trim() ||
        entry.codigoCie10?.trim();
      if (!entry.id || !sourceLabel) return null;
      const codeSuffix = entry.codigoCie10?.trim() ? ` (${entry.codigoCie10.trim()})` : '';
      return { id: entry.id, label: `${entry.prioridad}. ${sourceLabel}${codeSuffix}` };
    })
    .filter((entry): entry is TreatmentDiagnosisOption => Boolean(entry));

  const planText =
    typeof data.plan === 'string'
      ? data.plan
      : typeof data.indicaciones === 'string'
        ? data.indicaciones
        : '';

  const appendDictation = (field: keyof TratamientoData, transcript: string) => {
    const previous =
      field === 'plan'
        ? planText
        : typeof data[field] === 'string'
          ? data[field]
          : '';
    handleChange(field, `${previous ? `${previous} ` : ''}${transcript}`.trim());
  };

  const handlePlanChange = (value: string) => {
    const { indicaciones: _legacyIndicaciones, ...rest } = data;
    onChange({ ...rest, plan: value });
  };

  return (
    <div className="space-y-5">
      <SectionBlock title="Plan e indicaciones">
        <div className="space-y-4">
          <div>
            <SectionFieldHeader
              label="Plan de tratamiento e indicaciones"
              action={
                !readOnly ? (
                  <VoiceDictationButton
                    onTranscript={(text) => appendDictation('plan', text)}
                  />
                ) : undefined
              }
            />
            <textarea
              value={planText}
              onChange={(e) => handlePlanChange(e.target.value)}
              disabled={readOnly}
              rows={4}
              className="form-input form-textarea"
              placeholder=""
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Medicamentos">
        <StructuredMedicationsEditor
          medications={medicamentos}
          onChange={(next) => handleChange('medicamentosEstructurados', next)}
          readOnly={readOnly}
          allergyData={allergyData}
          diagnosticOptions={diagnosticOptions}
        />
        <div className="mt-4">
          <SectionFieldHeader
            label="Notas adicionales de receta (texto libre)"
            action={
              !readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) => appendDictation('receta', text)}
                />
              ) : undefined
            }
          />
          <textarea
            value={data.receta || ''}
            onChange={(e) => handleChange('receta', e.target.value)}
            disabled={readOnly}
            rows={2}
            className="form-input form-textarea"
            placeholder="Indicaciones adicionales que no encajen en los campos estructurados…"
          />
        </div>
      </SectionBlock>

      <SectionBlock title="Exámenes solicitados">
        <StructuredOrderBlock
          title="Exámenes solicitados"
          freeTextLabel="Exámenes solicitados"
          freeTextPlaceholder="Hemograma, perfil bioquímico, radiografía..."
          addLabel="Agregar examen estructurado"
          namePlaceholder="Examen"
          indicacionPlaceholder="Indicación"
          orderType="EXAMEN"
          items={examenes}
          freeTextValue={data.examenes || ''}
          readOnly={readOnly}
          linkedAttachmentsByOrderId={linkedAttachmentsByOrderId}
          diagnosticOptions={diagnosticOptions}
          createId={createId}
          onFreeTextChange={(value) => handleChange('examenes', value)}
          onDictation={(text) => appendDictation('examenes', text)}
          onChange={(next) => handleChange('examenesEstructurados', next)}
          onRequestAttachToOrder={onRequestAttachToOrder}
          onPreviewAttachment={onPreviewAttachment}
        />
      </SectionBlock>

      <SectionBlock title="Derivaciones">
        <StructuredOrderBlock
          title="Derivaciones"
          freeTextLabel="Derivaciones"
          freeTextPlaceholder="Especialista, motivo de derivación..."
          addLabel="Agregar derivación estructurada"
          namePlaceholder="Destino"
          indicacionPlaceholder="Motivo"
          orderType="DERIVACION"
          items={derivaciones}
          freeTextValue={data.derivaciones || ''}
          readOnly={readOnly}
          linkedAttachmentsByOrderId={linkedAttachmentsByOrderId}
          diagnosticOptions={diagnosticOptions}
          createId={createId}
          onFreeTextChange={(value) => handleChange('derivaciones', value)}
          onDictation={(text) => appendDictation('derivaciones', text)}
          onChange={(next) => handleChange('derivacionesEstructuradas', next)}
          onRequestAttachToOrder={onRequestAttachToOrder}
          onPreviewAttachment={onPreviewAttachment}
        />
      </SectionBlock>
    </div>
  );
}
