import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();

  const { usePrivacySettingsStore } = require('@/stores/privacy-settings-store') as typeof import('@/stores/privacy-settings-store');
  if ('persist' in usePrivacySettingsStore && usePrivacySettingsStore.persist) {
    usePrivacySettingsStore.persist.clearStorage();
  }
  if ('setState' in usePrivacySettingsStore && typeof usePrivacySettingsStore.setState === 'function') {
    usePrivacySettingsStore.setState({
      sharedDeviceMode: false,
      hasHydrated: true,
    });
  }

  const { useAuthStore } = require('@/stores/auth-store') as typeof import('@/stores/auth-store');
  if ('persist' in useAuthStore && useAuthStore.persist) {
    useAuthStore.persist.clearStorage();
  }
  if ('setState' in useAuthStore && typeof useAuthStore.setState === 'function') {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      hasHydrated: true,
    });
  }
});
