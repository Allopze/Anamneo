'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FiEdit3, FiX, FiCheck } from 'react-icons/fi';
import clsx from 'clsx';

interface Props {
  value: string;
  onSave: (value: string) => void;
  saving?: boolean;
  disabled?: boolean;
}

export default function FloatingQuickNotes({ value, onSave, saving, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, value]);

  const handleSave = useCallback(() => {
    if (draft !== value) {
      onSave(draft);
    }
    setOpen(false);
  }, [draft, value, onSave]);

  if (disabled) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-input border border-frame/15 bg-surface-elevated px-4 py-3 text-sm font-medium text-ink shadow-soft transition-colors hover:border-frame/30 hover:bg-surface-base"
      >
        <FiEdit3 className="h-4 w-4" />
        Notas rápidas internas
      </button>
    );
  }

  return (
    <div className="rounded-card border border-surface-muted/50 bg-surface-base">
      <div className="flex items-center justify-between border-b border-surface-muted/30 px-4 py-2.5">
        <span className="text-sm font-semibold text-ink">Notas rápidas</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded p-1 text-ink-secondary transition-colors hover:bg-surface-muted/50 hover:text-ink"
            title="Guardar y cerrar"
          >
            <FiCheck className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-ink-secondary transition-colors hover:bg-surface-muted/50 hover:text-ink"
            title="Cerrar"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="p-3">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          maxLength={3000}
          placeholder="Notas internas rápidas..."
          className="form-input form-textarea w-full text-sm"
        />
        <p className="mt-1 text-right text-xs text-ink-muted">
          {draft.length}/3000 · No se incluyen en el PDF
        </p>
      </div>
    </div>
  );
}
