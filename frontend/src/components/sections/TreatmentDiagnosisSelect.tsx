export type TreatmentDiagnosisOption = {
  id: string;
  label: string;
};

interface TreatmentDiagnosisSelectProps {
  options: TreatmentDiagnosisOption[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}

export default function TreatmentDiagnosisSelect({
  options,
  value,
  onChange,
  disabled,
  ariaLabel,
}: TreatmentDiagnosisSelectProps) {
  return (
    <select
      className="form-input"
      value={value || ''}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Diagnóstico asociado…</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}