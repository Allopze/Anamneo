import toast from 'react-hot-toast';
import { FiRotateCcw } from 'react-icons/fi';
import { getErrorMessage } from '@/lib/api';
import { useOnboarding } from '@/lib/onboarding';

export default function OnboardingSettingsSection() {
  const { eligible, resetOnboardingAsync, isResetting } = useOnboarding();

  if (!eligible) {
    return null;
  }

  const handleReset = async () => {
    try {
      await resetOnboardingAsync();
      toast.success('Guía inicial reiniciada');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="card mb-6">
      <div className="panel-header">
        <h2 className="panel-title">Guía inicial</h2>
      </div>

      <p className="text-sm text-ink-muted mb-4">
        Puedes volver a mostrar el checklist de primeros pasos en el inicio clínico de esta cuenta.
      </p>

      <button
        type="button"
        onClick={() => void handleReset()}
        disabled={isResetting}
        className="btn btn-secondary inline-flex items-center gap-2"
      >
        <FiRotateCcw className="h-4 w-4" aria-hidden="true" />
        {isResetting ? 'Reiniciando...' : 'Reiniciar guía inicial'}
      </button>
    </div>
  );
}
