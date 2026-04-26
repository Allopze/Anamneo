import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const PRIVACY_SETTINGS_STORAGE_KEY = 'anamneo-privacy-settings';
const FORCE_SHARED_DEVICE_MODE = process.env.NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE === 'true';

type PrivacySettingsState = {
  sharedDeviceMode: boolean;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  setSharedDeviceMode: (value: boolean) => void;
};

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function readPersistedSharedDeviceMode(): boolean {
  if (FORCE_SHARED_DEVICE_MODE) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const rawValue = window.localStorage.getItem(PRIVACY_SETTINGS_STORAGE_KEY);
    if (!rawValue) {
      return false;
    }

    const parsed = JSON.parse(rawValue) as {
      state?: { sharedDeviceMode?: boolean };
    };

    return Boolean(parsed.state?.sharedDeviceMode);
  } catch {
    return false;
  }
}

export const usePrivacySettingsStore = create<PrivacySettingsState>()(
  persist(
    (set) => ({
      sharedDeviceMode: FORCE_SHARED_DEVICE_MODE,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setSharedDeviceMode: (value) => set({ sharedDeviceMode: FORCE_SHARED_DEVICE_MODE ? true : value }),
    }),
    {
      name: PRIVACY_SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? window.localStorage : noopStorage)),
      partialize: (state) => ({ sharedDeviceMode: state.sharedDeviceMode }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export function isSharedDeviceModeEnabled(): boolean {
  if (FORCE_SHARED_DEVICE_MODE) {
    return true;
  }

  const state = usePrivacySettingsStore.getState();
  if (state.hasHydrated) {
    return state.sharedDeviceMode;
  }

  return readPersistedSharedDeviceMode() || state.sharedDeviceMode;
}

export function isSharedDeviceModeForced(): boolean {
  return FORCE_SHARED_DEVICE_MODE;
}