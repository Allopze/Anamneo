import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  nombre: string;
  role: 'MEDICO' | 'ASISTENTE' | 'ADMIN';
  isAdmin?: boolean;
  medicoId?: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  login: (user: User) => void;
  logout: () => void;
  isMedico: () => boolean;
  isAsistente: () => boolean;
  isAdmin: () => boolean;
  canCreatePatient: () => boolean;
  canCreateEncounter: () => boolean;
  canEditPatientAdmin: () => boolean;
  canUploadAttachments: () => boolean;
  canEditAntecedentes: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      setUser: (user) => set({ user }),

      login: (user) =>
        set({
          user,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
        }),

      isMedico: () => get().user?.role === 'MEDICO',

      isAsistente: () => get().user?.role === 'ASISTENTE',

      isAdmin: () => !!get().user?.isAdmin,

      canCreatePatient: () => {
        const user = get().user;
        if (!user) return false;
        return user.role === 'MEDICO' || (user.role === 'ASISTENTE' && !!user.medicoId);
      },

      canCreateEncounter: () => {
        const user = get().user;
        if (!user) return false;
        return user.role === 'MEDICO' || (user.role === 'ASISTENTE' && !!user.medicoId);
      },

      canEditPatientAdmin: () => {
        const user = get().user;
        if (!user) return false;
        return user.role === 'MEDICO' || (user.role === 'ASISTENTE' && !!user.medicoId);
      },

      canUploadAttachments: () => {
        const user = get().user;
        if (!user) return false;
        return user.role === 'MEDICO' || (user.role === 'ASISTENTE' && !!user.medicoId);
      },

      canEditAntecedentes: () => {
        const user = get().user;
        if (!user) return false;
        return user.role === 'MEDICO' || user.role === 'ASISTENTE';
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
