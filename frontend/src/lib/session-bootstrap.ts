import axios from 'axios';

export function shouldPreserveLocalSessionOnBootstrapError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (!error.response) {
    return true;
  }

  return error.response.status >= 500;
}