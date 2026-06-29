const LOGIN_PATH = '/login';

interface LocationLike {
  pathname?: string;
  search?: string;
  hash?: string;
}

export function sanitizeRedirectPath(path: string | null | undefined, fallback = '/pacientes') {
  if (!path || typeof path !== 'string') {
    return fallback;
  }

  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback;
  }

  return trimmed;
}

export function getCurrentAppPath(locationLike: LocationLike) {
  const pathname = sanitizeRedirectPath(locationLike.pathname ?? '/', '/');
  const search = typeof locationLike.search === 'string' ? locationLike.search : '';
  const hash = typeof locationLike.hash === 'string' ? locationLike.hash : '';
  return `${pathname}${search}${hash}`;
}

export function buildLoginRedirectPath(fromPath?: string | null) {
  const sanitizedFrom = sanitizeRedirectPath(fromPath, '');
  if (
    !sanitizedFrom
    || sanitizedFrom === LOGIN_PATH
    || sanitizedFrom.startsWith('/login?')
    || sanitizedFrom.startsWith('/login#')
  ) {
    return LOGIN_PATH;
  }

  const params = new URLSearchParams({ from: sanitizedFrom });
  return `${LOGIN_PATH}?${params.toString()}`;
}