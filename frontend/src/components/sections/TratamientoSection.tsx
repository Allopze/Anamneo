'use client';

import { useMemo } from 'react';
import { Attachment, HistoryFieldValue, TratamientoData } from '@/types';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import { FiAlertTriangle, FiEye, FiPaperclip, FiPlus, FiTrash2 } from 'react-icons/fi';
import { parseHistoryField } from '@/lib/utils';
import {
  SectionAddButton,
  SectionBlock,
  SectionCallout,
  SectionFieldHeader,
  SectionIconButton,
} from '@/components/sections/SectionPrimitives';
import LinkedAttachmentBlock from '@/components/sections/LinkedAttachmentBlock';

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

  const allergyKeywords = useMemo(() => {
    if (!allergyData) return [];
    const parsed = parseHistoryField(allergyData);
    const keywords: string[] = [];
    if (Array.isArray(parsed?.items)) {
      for (const item of parsed.items) {
        if (typeof item === 'string' && item.trim()) {
          keywords.push(item.trim().toLowerCase());
        }
      }
    }
    if (typeof parsed?.texto === 'string' && parsed.texto.trim()) {
      for (const word of parsed.texto.split(/[,;.\n]+/)) {
        const trimmed = word.trim().toLowerCase();
        if (trimmed.length >= 3) keywords.push(trimmed);
      }
    }
    return keywords;
  }, [allergyData]);

  function getAllergyMatch(medicationName: string): string | null {
    if (!medicationName || allergyKeywords.length === 0) return null;
    const lower = medicationName.toLowerCase();
    for (const keyword of allergyKeywords) {
      if (lower.includes(keyword) || keyword.includes(lower)) {
        return keyword;
      }
    }
    return null;
  }

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
        <div className="space-y-2">
          {medicamentos.map((medicamento, index) => {
            const allergyMatch = getAllergyMatch(medicamento.nombre || '');
            return (
            <div key={medicamento.id} className="section-item-card grid grid-cols-1 gap-2 md:grid-cols-6">
              <input
                className={`form-input md:col-span-2${allergyMatch ? ' !border-status-red/60 !ring-1 !ring-status-red/30' : ''}`}
                placeholder="Medicamento"
                value={medicamento.nombre || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const next = [...medicamentos];
                  next[index] = { ...next[index], nombre: e.target.value };
                  updateList('medicamentosEstructurados', next);
                }}
              />
              {allergyMatch && (
                <div className="flex items-center gap-1.5 md:col-span-full" role="alert">
                  <FiAlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-red" />
                  <span className="text-xs font-medium text-status-red-text">
                    Posible alergia registrada: {allergyMatch}
                  </span>
                </div>
              )}
              <input
                className="form-input"
                placeholder="Dosis"
                value={medicamento.dosis || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const next = [...medicamentos];
                  next[index] = { ...next[index], dosis: e.target.value };
                  updateList('medicamentosEstructurados', next);
                }}
              />
              <select
                className="form-input"
                value={medicamento.via || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const next = [...medicamentos];
                  next[index] = { ...next[index], via: e.target.value };
                  updateList('medicamentosEstructurados', next);
                }}
              >
                <option value="">Vía…</option>
                <option value="ORAL">Oral</option>
                <option value="IV">IV</option>
                <option value="IM">IM</option>
                <option value="SC">SC</option>
                <option value="TOPICA">Tópica</option>
                <option value="INHALATORIA">Inhalatoria</option>
                <option value="RECTAL">Rectal</option>
                <option value="SUBLINGUAL">Sublingual</option>
                <option value="OFTALMICA">Oftálmica</option>
                <option value="OTRA">Otra</option>
              </select>
              <input
                className="form-input"
                placeholder="Frecuencia"
                value={medicamento.frecuencia || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const next = [...medicamentos];
                  next[index] = { ...next[index], frecuencia: e.target.value };
                  updateList('medicamentosEstructurados', next);
                }}
              />
              {!readOnly && (
                <SectionIconButton
                  onClick={() => updateList('medicamentosEstructurados', medicamentos.filter((item) => item.id !== medicamento.id))}
                  tone="danger"
                  ariaLabel="Eliminar medicamento"
                >
                  <FiTrash2 className="h-4 w-4" />
                </SectionIconButton>
              )}
              <input
                className="form-input md:col-span-full"
                placeholder="Duración (ej: 7 días, uso continuo…)"
                value={medicamento.duracion || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const next = [...medicamentos];
                  next[index] = { ...next[index], duracion: e.target.value };
                  updateList('medicamentosEstructurados', next);
                }}
              />
            </div>
            );
          })}
          {!readOnly && (
            <SectionAddButton
              onClick={() =>
                updateList('medicamentosEstructurados', [
                  ...medicamentos,
                  { id: createId(), nombre: '', dosis: '', via: '', frecuencia: '', duracion: '', indicacion: '' },
                ])
              }
            >
              <FiPlus className="h-4 w-4" />
              Agregar medicamento
            </SectionAddButton>
          )}
        </div>
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
