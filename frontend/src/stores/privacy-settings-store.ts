import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const PRIVACY_SETTINGS_STORAGE_KEY = 'anamneo-privacy-settings';

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
      sharedDeviceMode: false,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setSharedDeviceMode: (value) => set({ sharedDeviceMode: value }),
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
  const state = usePrivacySettingsStore.getState();
  if (state.hasHydrated) {
    return state.sharedDeviceMode;
  }

  return readPersistedSharedDeviceMode() || state.sharedDeviceMode;
}