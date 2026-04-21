import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearEncounterLocalStateForUser } from '@/lib/encounter-draft';
import { clearPendingSavesForUser } from '@/lib/offline-queue';
import {
  canCreateEncounter as canCreateEncounterPermission,
  canCreatePatient as canCreatePatientPermission,
  canEditAntecedentes as canEditAntecedentesPermission,
  canEditPatientAdmin as canEditPatientAdminPermission,
  canUploadAttachments as canUploadAttachmentsPermission,
  isAssistantUser,
  isMedicoUser,
} from '@/lib/permissions';

export interface User {
  id: string;
  email: string;
  nombre: string;
  role: 'MEDICO' | 'ASISTENTE' | 'ADMIN';
  isAdmin?: boolean;
  medicoId?: string | null;
  mustChangePassword?: boolean;
  totpEnabled?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  setUser: (user: User) => void;
  setHasHydrated: (value: boolean) => void;
  login: (user: User) => void;
  logout: (options?: { clearLocalState?: boolean }) => void;
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
      hasHydrated: false,

      setUser: (user) => set({ user }),

      setHasHydrated: (value) => set({ hasHydrated: value }),

      login: (user) =>
        set({
          user,
          isAuthenticated: true,
        }),

      logout: (options) => {
        const currentUserId = get().user?.id;
        if (currentUserId && options?.clearLocalState) {
          clearEncounterLocalStateForUser(currentUserId);
          void clearPendingSavesForUser(currentUserId).catch(() => {
            // Ignore IndexedDB cleanup failures; the session still must close.
          });
        }

        set({
          user: null,
          isAuthenticated: false,
        });
      },

      isMedico: () => isMedicoUser(get().user),

      isAsistente: () => isAssistantUser(get().user),

      isAdmin: () => !!get().user?.isAdmin,

      canCreatePatient: () => canCreatePatientPermission(get().user),

      canCreateEncounter: () => canCreateEncounterPermission(get().user),

      canEditPatientAdmin: () => canEditPatientAdminPermission(get().user),

      canUploadAttachments: () => canUploadAttachmentsPermission(get().user),

      canEditAntecedentes: () => canEditAntecedentesPermission(get().user),
    }),
    {
      name: 'auth-storage',
      storage: typeof window !== 'undefined'
        ? {
            getItem: (name: string) => {
              const value = sessionStorage.getItem(name);
              return value ? JSON.parse(value) : null;
            },
            setItem: (name: string, value: unknown) => {
              sessionStorage.setItem(name, JSON.stringify(value));
            },
            removeItem: (name: string) => {
              sessionStorage.removeItem(name);
            },
          }
        : undefined,
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
