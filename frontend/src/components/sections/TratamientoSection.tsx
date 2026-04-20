'use client';

import { Attachment, HistoryFieldValue, TratamientoData } from '@/types';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import { FiEye, FiPaperclip, FiPlus, FiTrash2 } from 'react-icons/fi';
import {
  SectionAddButton,
  SectionBlock,
  SectionCallout,
  SectionFieldHeader,
  SectionIconButton,
} from '@/components/sections/SectionPrimitives';
import LinkedAttachmentBlock from '@/components/sections/LinkedAttachmentBlock';
import StructuredMedicationsEditor from '@/components/sections/StructuredMedicationsEditor';

interface Props {
  data: TratamientoData;
  onChange: (data: TratamientoData) => void;
  readOnly?: boolean;
  linkedAttachmentsByOrderId?: Record<string, Attachment[]>;
  onRequestAttachToOrder?: (type: 'EXAMEN' | 'DERIVACION', orderId: string) => void;
  onPreviewAttachment?: (attachment: Attachment) => void;
  allergyData?: HistoryFieldValue | string;
}

export default function TratamientoSection({
  data,
  onChange,
  readOnly,
  linkedAttachmentsByOrderId,
  onRequestAttachToOrder,
  onPreviewAttachment,
  allergyData,
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
  const planText = typeof data.plan === 'string'
    ? data.plan
    : typeof data.indicaciones === 'string'
    ? data.indicaciones
    : '';

  const appendDictation = (field: keyof TratamientoData, transcript: string) => {
    const previous = field === 'plan'
      ? planText
      : typeof data[field] === 'string'
      ? data[field]
      : '';
    handleChange(field, `${previous ? `${previous} ` : ''}${transcript}`.trim());
  };

  const handlePlanChange = (value: string) => {
    const { indicaciones: _legacyIndicaciones, ...rest } = data;
    onChange({
      ...rest,
      plan: value,
    });
  };

  const updateList = (field: 'medicamentosEstructurados' | 'examenesEstructurados' | 'derivacionesEstructuradas', next: any[]) => {
    handleChange(field, next);
  };

  return (
    <div className="space-y-5">
      <SectionBlock title="Plan e indicaciones">
        <div className="space-y-4">
          <div>
            <SectionFieldHeader
              label="Plan de tratamiento e indicaciones"
              action={!readOnly ? <VoiceDictationButton onTranscript={(text) => appendDictation('plan', text)} /> : undefined}
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
          onChange={(next) => updateList('medicamentosEstructurados', next)}
          readOnly={readOnly}
          allergyData={allergyData}
        />
        <div className="mt-4">
          <SectionFieldHeader
            label="Notas adicionales de receta (texto libre)"
            action={!readOnly ? <VoiceDictationButton onTranscript={(text) => appendDictation('receta', text)} /> : undefined}
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
        <SectionFieldHeader
          label="Exámenes solicitados"
          action={!readOnly ? <VoiceDictationButton onTranscript={(text) => appendDictation('examenes', text)} /> : undefined}
        />
        <textarea
          value={data.examenes || ''}
          onChange={(e) => handleChange('examenes', e.target.value)}
          disabled={readOnly}
          rows={2}
          className="form-input form-textarea"
          placeholder="Hemograma, perfil bioquímico, radiografía..."
        />
        <div className="mt-3 space-y-2">
          {examenes.map((orden, index) => (
            <div key={orden.id} className="section-item-card grid grid-cols-1 gap-2 md:grid-cols-4">
              <input
                className="form-input"
                placeholder="Examen"
                value={orden.nombre || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const next = [...examenes];
                  next[index] = { ...next[index], nombre: e.target.value };
                  updateList('examenesEstructurados', next);
                }}
              />
              <input
                className="form-input"
                placeholder="Indicación"
                value={orden.indicacion || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const next = [...examenes];
                  next[index] = { ...next[index], indicacion: e.target.value };
                  updateList('examenesEstructurados', next);
                }}
              />
              <select
                className="form-input"
                value={orden.estado || 'PENDIENTE'}
                disabled={readOnly}
                onChange={(e) => {
                  const next = [...examenes];
                  next[index] = { ...next[index], estado: e.target.value as 'PENDIENTE' | 'RECIBIDO' | 'REVISADO' };
                  updateList('examenesEstructurados', next);
                }}
              >
                <option value="PENDIENTE">Pendiente</option>
                <option value="RECIBIDO">Recibido</option>
                <option value="REVISADO">Revisado</option>
              </select>
              {!readOnly && (
                <SectionIconButton
                  onClick={() => updateList('examenesEstructurados', examenes.filter((item) => item.id !== orden.id))}
                  tone="danger"
                  ariaLabel="Eliminar examen"
                >
                  <FiTrash2 className="h-4 w-4" />
                </SectionIconButton>
              )}
              {orden.id && (
                <LinkedAttachmentBlock
                  orderId={orden.id}
                  type="EXAMEN"
                  linkedAttachmentsByOrderId={linkedAttachmentsByOrderId}
                  readOnly={readOnly}
                  onRequestAttachToOrder={onRequestAttachToOrder}
                  onPreviewAttachment={onPreviewAttachment}
                />
              )}
            </div>
          ))}
          {!readOnly && (
            <SectionAddButton
              onClick={() =>
                updateList('examenesEstructurados', [
                  ...examenes,
                  { id: createId(), nombre: '', indicacion: '', estado: 'PENDIENTE', resultado: '' },
                ])
              }
            >
              <FiPlus className="h-4 w-4" />
              Agregar examen estructurado
            </SectionAddButton>
          )}
        </div>
      </SectionBlock>

      <SectionBlock title="Derivaciones">
        <SectionFieldHeader
          label="Derivaciones"
          action={!readOnly ? <VoiceDictationButton onTranscript={(text) => appendDictation('derivaciones', text)} /> : undefined}
        />
        <textarea
          value={data.derivaciones || ''}
          onChange={(e) => handleChange('derivaciones', e.target.value)}
          disabled={readOnly}
          rows={2}
          className="form-input form-textarea"
          placeholder="Especialista, motivo de derivación..."
        />
        <div className="mt-3 space-y-2">
          {derivaciones.map((orden, index) => (
            <div key={orden.id} className="section-item-card grid grid-cols-1 gap-2 md:grid-cols-4">
              <input
                className="form-input"
                placeholder="Destino"
                value={orden.nombre || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const next = [...derivaciones];
                  next[index] = { ...next[index], nombre: e.target.value };
                  updateList('derivacionesEstructuradas', next);
                }}
              />
              <input
                className="form-input"
                placeholder="Motivo"
                value={orden.indicacion || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const next = [...derivaciones];
                  next[index] = { ...next[index], indicacion: e.target.value };
                  updateList('derivacionesEstructuradas', next);
                }}
              />
              <select
                className="form-input"
                value={orden.estado || 'PENDIENTE'}
                disabled={readOnly}
                onChange={(e) => {
                  const next = [...derivaciones];
                  next[index] = { ...next[index], estado: e.target.value as 'PENDIENTE' | 'RECIBIDO' | 'REVISADO' };
                  updateList('derivacionesEstructuradas', next);
                }}
              >
                <option value="PENDIENTE">Pendiente</option>
                <option value="RECIBIDO">Recibido</option>
                <option value="REVISADO">Revisado</option>
              </select>
              {!readOnly && (
                <SectionIconButton
                  onClick={() => updateList('derivacionesEstructuradas', derivaciones.filter((item) => item.id !== orden.id))}
                  tone="danger"
                  ariaLabel="Eliminar derivación"
                >
                  <FiTrash2 className="h-4 w-4" />
                </SectionIconButton>
              )}
              {orden.id && (
                <LinkedAttachmentBlock
                  orderId={orden.id}
                  type="DERIVACION"
                  linkedAttachmentsByOrderId={linkedAttachmentsByOrderId}
                  readOnly={readOnly}
                  onRequestAttachToOrder={onRequestAttachToOrder}
                  onPreviewAttachment={onPreviewAttachment}
                />
              )}
            </div>
          ))}
          {!readOnly && (
            <SectionAddButton
              onClick={() =>
                updateList('derivacionesEstructuradas', [
                  ...derivaciones,
                  { id: createId(), nombre: '', indicacion: '', estado: 'PENDIENTE', resultado: '' },
                ])
              }
            >
              <FiPlus className="h-4 w-4" />
              Agregar derivación estructurada
            </SectionAddButton>
          )}
        </div>
      </SectionBlock>
    </div>
  );
}
