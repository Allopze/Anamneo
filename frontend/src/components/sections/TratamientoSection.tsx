'use client';

import { Attachment, TratamientoData } from '@/types';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import { FiPaperclip, FiPlus, FiTrash2 } from 'react-icons/fi';
import { getTreatmentPlanText } from '@/lib/clinical';
import {
  SectionAddButton,
  SectionBlock,
  SectionCallout,
  SectionFieldHeader,
  SectionIconButton,
  SectionIntro,
} from '@/components/sections/SectionPrimitives';

interface Props {
  data: TratamientoData;
  onChange: (data: TratamientoData) => void;
  readOnly?: boolean;
  linkedAttachmentsByOrderId?: Record<string, Attachment[]>;
  onRequestAttachToOrder?: (type: 'EXAMEN' | 'DERIVACION', orderId: string) => void;
}

export default function TratamientoSection({
  data,
  onChange,
  readOnly,
  linkedAttachmentsByOrderId,
  onRequestAttachToOrder,
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
  const planText = getTreatmentPlanText(data);

  const appendDictation = (field: keyof TratamientoData, transcript: string) => {
    const previous = field === 'plan'
      ? planText
      : typeof data[field] === 'string'
      ? data[field]
      : '';
    handleChange(field, `${previous ? `${previous} ` : ''}${transcript}`.trim());
  };

  const handlePlanChange = (value: string) => {
    onChange({
      ...data,
      plan: value,
    });
  };

  const updateList = (field: 'medicamentosEstructurados' | 'examenesEstructurados' | 'derivacionesEstructuradas', next: any[]) => {
    handleChange(field, next);
  };

  const renderLinkedAttachments = (orderId: string, type: 'EXAMEN' | 'DERIVACION') => {
    const linkedAttachments = linkedAttachmentsByOrderId?.[orderId] || [];

    if (linkedAttachments.length === 0 && (readOnly || !onRequestAttachToOrder)) {
      return null;
    }

    return (
      <div className="md:col-span-full">
        <SectionCallout
          tone="subtle"
          actions={!readOnly && onRequestAttachToOrder ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm font-medium text-accent-text hover:text-ink"
              onClick={() => onRequestAttachToOrder(type, orderId)}
            >
              <FiPaperclip className="h-4 w-4" />
              {type === 'EXAMEN' ? 'Adjuntar resultado' : 'Adjuntar respaldo'}
            </button>
          ) : undefined}
        >
          <div>
            <p className="text-sm font-medium text-ink-primary">
              {linkedAttachments.length > 0
                ? `${linkedAttachments.length} adjunto${linkedAttachments.length === 1 ? '' : 's'} vinculado${linkedAttachments.length === 1 ? '' : 's'}`
                : 'Sin adjuntos vinculados todavía'}
            </p>
            <p className="text-xs text-ink-muted">
              {type === 'EXAMEN'
                ? 'Usa este vínculo para agrupar resultados del examen solicitado.'
                : 'Usa este vínculo para asociar respaldos de la derivación.'}
            </p>
          </div>
        </SectionCallout>
        {linkedAttachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {linkedAttachments.map((attachment) => (
              <div key={attachment.id} className="section-item-card px-3 py-2">
                <div className="text-sm font-medium text-ink-primary">{attachment.originalName}</div>
                <div className="text-xs text-ink-muted">
                  {[attachment.description, attachment.uploadedAt ? new Date(attachment.uploadedAt).toLocaleDateString('es-CL') : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <SectionIntro description="Documenta el plan terapéutico, indicaciones y órdenes estructuradas usando un formato consistente y trazable." />

      <SectionBlock title="Plan e indicaciones" description="Tratamiento general e instrucciones prácticas entregadas al paciente.">
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
              placeholder="Describa el plan terapéutico, cuidados e indicaciones entregadas al paciente..."
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Medicamentos" description="Agrega medicamentos estructurados como mecanismo principal. El texto libre complementa si hace falta.">
        <div className="space-y-2">
          {medicamentos.map((medicamento, index) => (
            <div key={medicamento.id} className="section-item-card grid grid-cols-1 gap-2 md:grid-cols-6">
              <input
                className="form-input md:col-span-2"
                placeholder="Medicamento"
                value={medicamento.nombre || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const next = [...medicamentos];
                  next[index] = { ...next[index], nombre: e.target.value };
                  updateList('medicamentosEstructurados', next);
                }}
              />
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
          ))}
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

      <SectionBlock title="Exámenes solicitados" description="Órdenes clínicas con estado y respaldo vinculado cuando corresponda.">
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
              {orden.id && renderLinkedAttachments(orden.id, 'EXAMEN')}
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

      <SectionBlock title="Derivaciones" description="Interconsultas o derivaciones con seguimiento de estado y respaldo asociado.">
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
              {orden.id && renderLinkedAttachments(orden.id, 'DERIVACION')}
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
