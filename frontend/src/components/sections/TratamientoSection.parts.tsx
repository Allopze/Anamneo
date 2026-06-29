'use client';

/**
 * Sub-components used by TratamientoSection.
 * Not exported from the public barrel.
 */

import type { Attachment, StructuredOrder } from '@/types';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import {
  SectionAddButton,
  SectionFieldHeader,
  SectionIconButton,
} from '@/components/sections/SectionPrimitives';
import LinkedAttachmentBlock from '@/components/sections/LinkedAttachmentBlock';
import TreatmentDiagnosisSelect, {
  type TreatmentDiagnosisOption,
} from '@/components/sections/TreatmentDiagnosisSelect';

interface StructuredOrderBlockProps {
  title: string;
  freeTextLabel: string;
  freeTextPlaceholder: string;
  addLabel: string;
  namePlaceholder: string;
  indicacionPlaceholder: string;
  orderType: 'EXAMEN' | 'DERIVACION';
  items: StructuredOrder[];
  freeTextValue: string;
  readOnly?: boolean;
  linkedAttachmentsByOrderId?: Record<string, Attachment[]>;
  diagnosticOptions: TreatmentDiagnosisOption[];
  createId: () => string;
  onFreeTextChange: (value: string) => void;
  onDictation: (transcript: string) => void;
  onChange: (items: StructuredOrder[]) => void;
  onRequestAttachToOrder?: (type: 'EXAMEN' | 'DERIVACION', orderId: string) => void;
  onPreviewAttachment?: (attachment: Attachment) => void;
}

/**
 * Renders a text-free area + structured list of StructuredOrder items
 * (either exámenes or derivaciones). The two blocks in TratamientoSection
 * are structurally identical — this component handles both.
 */
export function StructuredOrderBlock({
  title: _title,
  freeTextLabel,
  freeTextPlaceholder,
  addLabel,
  namePlaceholder,
  indicacionPlaceholder,
  orderType,
  items,
  freeTextValue,
  readOnly,
  linkedAttachmentsByOrderId,
  diagnosticOptions,
  createId,
  onFreeTextChange,
  onDictation,
  onChange,
  onRequestAttachToOrder,
  onPreviewAttachment,
}: StructuredOrderBlockProps) {
  const updateItem = (index: number, patch: Partial<StructuredOrder>) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const addItem = () => {
    onChange([
      ...items,
      { id: createId(), nombre: '', indicacion: '', estado: 'PENDIENTE', resultado: '' },
    ]);
  };

  return (
    <>
      <SectionFieldHeader
        label={freeTextLabel}
        action={
          !readOnly ? (
            <VoiceDictationButton onTranscript={onDictation} />
          ) : undefined
        }
      />
      <textarea
        value={freeTextValue}
        onChange={(e) => onFreeTextChange(e.target.value)}
        disabled={readOnly}
        rows={2}
        className="form-input form-textarea"
        placeholder={freeTextPlaceholder}
      />
      <div className="mt-3 space-y-2">
        {items.map((orden, index) => (
          <div
            key={orden.id}
            className="section-item-card grid grid-cols-1 gap-2 md:grid-cols-5"
          >
            <input
              className="form-input"
              placeholder={namePlaceholder}
              value={orden.nombre || ''}
              disabled={readOnly}
              onChange={(e) => updateItem(index, { nombre: e.target.value })}
            />
            <input
              className="form-input"
              placeholder={indicacionPlaceholder}
              value={orden.indicacion || ''}
              disabled={readOnly}
              onChange={(e) => updateItem(index, { indicacion: e.target.value })}
            />
            <select
              className="form-input"
              value={orden.estado || 'PENDIENTE'}
              disabled={readOnly}
              onChange={(e) =>
                updateItem(index, {
                  estado: e.target.value as 'PENDIENTE' | 'RECIBIDO' | 'REVISADO',
                })
              }
            >
              <option value="PENDIENTE">Pendiente</option>
              <option value="RECIBIDO">Recibido</option>
              <option value="REVISADO">Revisado</option>
            </select>
            {diagnosticOptions.length > 0 ? (
              <TreatmentDiagnosisSelect
                options={diagnosticOptions}
                value={orden.sospechaId}
                disabled={readOnly}
                ariaLabel={`Diagnóstico asociado del ${orderType === 'EXAMEN' ? 'examen' : 'derivación'}`}
                onChange={(value) => updateItem(index, { sospechaId: value || undefined })}
              />
            ) : null}
            {!readOnly && (
              <SectionIconButton
                onClick={() => removeItem(orden.id)}
                tone="danger"
                ariaLabel={`Eliminar ${orderType === 'EXAMEN' ? 'examen' : 'derivación'}`}
              >
                <FiTrash2 className="h-4 w-4" />
              </SectionIconButton>
            )}
            {orden.id && (
              <LinkedAttachmentBlock
                orderId={orden.id}
                type={orderType}
                linkedAttachmentsByOrderId={linkedAttachmentsByOrderId}
                readOnly={readOnly}
                onRequestAttachToOrder={onRequestAttachToOrder}
                onPreviewAttachment={onPreviewAttachment}
              />
            )}
          </div>
        ))}
        {!readOnly && (
          <SectionAddButton onClick={addItem}>
            <FiPlus className="h-4 w-4" />
            {addLabel}
          </SectionAddButton>
        )}
      </div>
    </>
  );
}
