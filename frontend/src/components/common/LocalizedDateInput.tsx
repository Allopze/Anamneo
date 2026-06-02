'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';

function isoToDisplay(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

function displayToIso(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return '';

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return '';
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function isoDigitsToDisplay(value: string) {
  if (value.length !== 8) return '';
  const year = Number.parseInt(value.slice(0, 4), 10);
  const month = Number.parseInt(value.slice(4, 6), 10);
  const day = Number.parseInt(value.slice(6, 8), 10);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return '';
  }

  return `${value.slice(6, 8)}-${value.slice(4, 6)}-${value.slice(0, 4)}`;
}

function maskDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const isoDisplay = isoDigitsToDisplay(digits);
  if (isoDisplay) return isoDisplay;
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

interface LocalizedDateInputProps {
  id: string;
  name?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  className?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  autoComplete?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export default function LocalizedDateInput({
  id,
  name,
  value,
  onChange,
  className,
  min,
  max,
  disabled,
  autoComplete,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: LocalizedDateInputProps) {
  const normalizedValue = value ?? '';
  const externalDisplayValue = useMemo(() => isoToDisplay(normalizedValue), [normalizedValue]);
  const [displayValue, setDisplayValue] = useState(externalDisplayValue);

  useEffect(() => {
    setDisplayValue(externalDisplayValue);
  }, [externalDisplayValue]);

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete={autoComplete}
      disabled={disabled}
      className={clsx(className)}
      placeholder="dd-mm-aaaa"
      value={displayValue}
      aria-label={ariaLabel}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      onChange={(event) => {
        const nextDisplay = maskDate(event.target.value);
        const nextIso = displayToIso(nextDisplay);
        setDisplayValue(nextDisplay);
        onChange(
          nextIso
          && (!min || nextIso >= min)
          && (!max || nextIso <= max)
            ? nextIso
            : '',
        );
      }}
      onBlur={() => {
        const nextIso = displayToIso(displayValue);
        if (!nextIso || (min && nextIso < min) || (max && nextIso > max)) {
          setDisplayValue(externalDisplayValue);
        }
      }}
    />
  );
}
