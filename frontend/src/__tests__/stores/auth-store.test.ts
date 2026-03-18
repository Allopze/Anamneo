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
  act(() => {
    useAuthStore.getState().logout();
  });
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

  it('logout clears user', () => {
    act(() => {
      useAuthStore.getState().login(medicoUser);
      useAuthStore.getState().logout();
    });

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
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

    it('unassigned asistente cannot create patients', () => {
      act(() =>
        useAuthStore.getState().login({ ...asistenteUser, medicoId: null })
      );
      expect(useAuthStore.getState().canCreatePatient()).toBe(false);
    });
  });
});
