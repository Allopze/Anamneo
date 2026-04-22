import axios from 'axios';

export function shouldPreserveLocalSessionOnBootstrapError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (error.request && !error.response) {
    return true;
  }

  return false;
}