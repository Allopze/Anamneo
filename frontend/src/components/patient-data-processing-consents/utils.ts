import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PURPOSES } from './constants';

export function purposeLabel(value: string): string {
  return PURPOSES.find((p) => p.value === value)?.label ?? value;
}

export function formatConsentDate(date: string) {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: es });
}
