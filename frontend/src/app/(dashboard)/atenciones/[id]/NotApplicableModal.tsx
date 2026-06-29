interface NotApplicableModalProps {
  isOpen: boolean;
  reason: string;
  isSaving: boolean;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function NotApplicableModal({
  isOpen,
  reason,
  isSaving,
  onReasonChange,
  onClose,
  onConfirm,
}: NotApplicableModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-card border border-surface-muted bg-surface-base p-6 shadow-lg">
        <h3 className="text-base font-semibold text-ink">Marcar sección como &ldquo;No aplica&rdquo;</h3>
        <p className="mt-2 text-sm text-ink-secondary">
          Indique el motivo por el que esta sección no aplica para este paciente (mínimo 10 caracteres).
        </p>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          className="form-input mt-3 min-h-[80px] w-full resize-y"
          placeholder="Ej: Paciente pediátrico, no corresponde revisión de sistemas…"
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={reason.trim().length < 10 || isSaving}
            className="btn btn-primary"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
