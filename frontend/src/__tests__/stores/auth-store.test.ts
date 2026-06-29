const clearEncounterLocalStateForUserMock = jest.fn();
const clearPendingSavesForUserMock = jest.fn();

jest.mock('@/lib/encounter-draft', () => ({
  clearEncounterLocalStateForUser: (...args: unknown[]) => clearEncounterLocalStateForUserMock(...args),
}));

jest.mock('@/lib/offline-queue', () => ({
  clearPendingSavesForUser: (...args: unknown[]) => clearPendingSavesForUserMock(...args),
}));

import { useAuthStore, User } from '@/stores/auth-store';
import { act } from '@testing-library/react';

const medicoUser: User = {
  id: '1',
  email: 'doc@test.cl',
  nombre: 'Dr. Test',
  role: 'MEDICO',
};

const adminUser: User = {
  id: '2',
  email: 'admin@test.cl',
  nombre: 'Admin',
  role: 'ADMIN',
  isAdmin: true,
};

const asistenteUser: User = {
  id: '3',
  email: 'asist@test.cl',
  nombre: 'Asistente',
  role: 'ASISTENTE',
  medicoId: 'med1',
};

beforeEach(() => {
  clearEncounterLocalStateForUserMock.mockReset();
  clearPendingSavesForUserMock.mockReset();
  clearPendingSavesForUserMock.mockResolvedValue(undefined);
  act(() => {
    useAuthStore.getState().logout({ clearLocalState: true });
  });
  clearEncounterLocalStateForUserMock.mockReset();
  clearPendingSavesForUserMock.mockReset();
  clearPendingSavesForUserMock.mockResolvedValue(undefined);
});

describe('useAuthStore', () => {
  it('starts with no user', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('login sets user and isAuthenticated', () => {
    act(() => {
      useAuthStore.getState().login(medicoUser);
    });

    const state = useAuthStore.getState();
    expect(state.user).toEqual(medicoUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('logout clears user and wipes drafts by default', () => {
    act(() => {
      useAuthStore.getState().login(medicoUser);
      useAuthStore.getState().logout();
    });

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(clearEncounterLocalStateForUserMock).toHaveBeenCalledWith('1');
    expect(clearPendingSavesForUserMock).toHaveBeenCalledWith('1');
  });

  it('logout can preserve local drafts when explicitly requested', () => {
    act(() => {
      useAuthStore.getState().login(medicoUser);
      useAuthStore.getState().logout({ clearLocalState: false });
    });

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(clearEncounterLocalStateForUserMock).not.toHaveBeenCalled();
    expect(clearPendingSavesForUserMock).not.toHaveBeenCalled();
  });

  it('setUser updates user without changing isAuthenticated', () => {
    act(() => {
      useAuthStore.getState().login(medicoUser);
      useAuthStore.getState().setUser(adminUser);
    });

    const state = useAuthStore.getState();
    expect(state.user).toEqual(adminUser);
    expect(state.isAuthenticated).toBe(true);
  });

  describe('role helpers', () => {
    it('isMedico', () => {
      act(() => useAuthStore.getState().login(medicoUser));
      expect(useAuthStore.getState().isMedico()).toBe(true);
      expect(useAuthStore.getState().isAsistente()).toBe(false);
    });

    it('isAsistente', () => {
      act(() => useAuthStore.getState().login(asistenteUser));
      expect(useAuthStore.getState().isAsistente()).toBe(true);
      expect(useAuthStore.getState().isMedico()).toBe(false);
    });

    it('isAdmin', () => {
      act(() => useAuthStore.getState().login(adminUser));
      expect(useAuthStore.getState().isAdmin()).toBe(true);
      expect(useAuthStore.getState().isMedico()).toBe(false);
    });
  });

  describe('permission helpers', () => {
    it('medico can create patients and encounters', () => {
      act(() => useAuthStore.getState().login(medicoUser));
      expect(useAuthStore.getState().canCreatePatient()).toBe(true);
      expect(useAuthStore.getState().canCreateEncounter()).toBe(true);
    });

    it('assigned asistente can create patients', () => {
      act(() => useAuthStore.getState().login(asistenteUser));
      expect(useAuthStore.getState().canCreatePatient()).toBe(true);
    });

    it('admin cannot create patients or encounters', () => {
      act(() => useAuthStore.getState().login(adminUser));
      expect(useAuthStore.getState().canCreatePatient()).toBe(false);
      expect(useAuthStore.getState().canCreateEncounter()).toBe(false);
    });

    it('unassigned asistente cannot create patients', () => {
      act(() =>
        useAuthStore.getState().login({ ...asistenteUser, medicoId: null })
      );
      expect(useAuthStore.getState().canCreatePatient()).toBe(false);
    });
  });
});
