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

  return (
    <>
      {/* FAB button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-accent shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          title="Notas rápidas"
        >
          <FiEdit3 className="h-5 w-5 text-white" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 rounded-card border border-surface-muted/50 bg-surface-base shadow-xl">
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
      )}
    </>
  );
}
