import { AsyncLocalStorage } from 'async_hooks';

interface RequestContextStore {
  requestId?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(store: RequestContextStore, callback: () => T) {
  return requestContextStorage.run(store, callback);
}

export function enterWithRequestContext(store: RequestContextStore) {
  requestContextStorage.enterWith(store);
}

export function getRequestId() {
  return requestContextStorage.getStore()?.requestId;
}
