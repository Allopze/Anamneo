import toast from 'react-hot-toast';

interface TwoFactorRecoveryCodesPanelProps {
  codes: string[];
  onDismiss?: () => void;
}

export default function TwoFactorRecoveryCodesPanel({
  codes,
  onDismiss,
}: TwoFactorRecoveryCodesPanelProps) {
  const handleCopy = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      toast.error('Este navegador no permite copiar los códigos automáticamente.');
      return;
    }

    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      toast.success('Códigos de recuperación copiados');
    } catch {
      toast.error('No se pudieron copiar los códigos de recuperación.');
    }
  };

  return (
    <div className="rounded-2xl border border-status-yellow/40 bg-status-yellow/10 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Códigos de recuperación</p>
          <p className="mt-1 text-sm text-ink-secondary">
            Guárdalos fuera del navegador. Cada código sirve una sola vez para entrar si no tienes acceso a tu app autenticadora.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void handleCopy()} className="btn btn-secondary">
            Copiar códigos
          </button>
          {onDismiss ? (
            <button type="button" onClick={onDismiss} className="btn btn-secondary">
              Ocultar
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {codes.map((code) => (
          <div
            key={code}
            className="rounded-xl border border-surface-muted/40 bg-white/80 px-3 py-2 font-mono text-sm tracking-[0.18em] text-ink-primary"
          >
            {code}
          </div>
        ))}
      </div>
    </div>
  );
}