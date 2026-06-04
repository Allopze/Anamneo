import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthLogin } from '@/stores/auth-store';
import { stashAuthSessionPrefill, toAuthUser } from '@/lib/auth-session';
import { feedbackCopy, notify } from '@/lib/notify';
import {
  getLegalDocumentByType,
  type CurrentLegalDocumentsResponse,
} from '@/lib/legal-content';
import {
  REGISTER_DRAFT_KEY,
  registerSchema,
  type RegisterForm,
  type RegisterRole,
} from './register.constants';

export function useRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthLogin();
  const invitationTokenFromQuery = searchParams.get('token')?.trim() || null;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<RegisterRole[]>(['ADMIN']);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationEmail, setInvitationEmail] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [isInvitationMode, setIsInvitationMode] = useState(false);
  const [requiresBootstrapToken, setRequiresBootstrapToken] = useState(false);
  const registerDraftWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRegisterDraftRef = useRef<string | null>(null);

  const bootstrapQuery = useQuery({
    queryKey: ['auth', 'bootstrap'],
    queryFn: () =>
      api.get('/auth/bootstrap').then(
        (r) => r.data as { hasAdmin: boolean; requiresBootstrapToken?: boolean },
      ),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const invitationQuery = useQuery({
    queryKey: ['auth', 'invitation', invitationTokenFromQuery],
    queryFn: () =>
      api
        .get(`/auth/invitations/${invitationTokenFromQuery}`)
        .then((r) => r.data as { role: RegisterRole; email: string }),
    enabled: Boolean(bootstrapQuery.data?.hasAdmin && invitationTokenFromQuery),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const legalDocumentsQuery = useQuery({
    queryKey: ['legal-documents', 'current'],
    queryFn: async () => {
      const response = await api.get('/legal/documents/current');
      return response.data as CurrentLegalDocumentsResponse;
    },
    retry: false,
    staleTime: 5 * 60_000,
  });

  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'MEDICO', acceptedLegal: false },
  });

  // Restore draft from sessionStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const rawDraft = window.sessionStorage.getItem(REGISTER_DRAFT_KEY);
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as Partial<RegisterForm>;
      if (typeof draft.nombre === 'string')
        setValue('nombre', draft.nombre, { shouldValidate: false, shouldDirty: false });
      if (typeof draft.email === 'string')
        setValue('email', draft.email, { shouldValidate: false, shouldDirty: false });
      if (draft.role === 'ADMIN' || draft.role === 'MEDICO' || draft.role === 'ASISTENTE')
        setValue('role', draft.role, { shouldValidate: false, shouldDirty: false });
    } catch {
      window.sessionStorage.removeItem(REGISTER_DRAFT_KEY);
    }
  }, [setValue]);

  // Persist draft to sessionStorage as user types
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const subscription = watch((value) => {
      const safeDraft = { nombre: value.nombre, email: value.email, role: value.role };
      pendingRegisterDraftRef.current = JSON.stringify(safeDraft);

      if (registerDraftWriteTimerRef.current) clearTimeout(registerDraftWriteTimerRef.current);

      registerDraftWriteTimerRef.current = setTimeout(() => {
        if (pendingRegisterDraftRef.current) {
          window.sessionStorage.setItem(REGISTER_DRAFT_KEY, pendingRegisterDraftRef.current);
        }
      }, 300);
    });

    return () => {
      if (registerDraftWriteTimerRef.current) clearTimeout(registerDraftWriteTimerRef.current);
      if (pendingRegisterDraftRef.current) {
        window.sessionStorage.setItem(REGISTER_DRAFT_KEY, pendingRegisterDraftRef.current);
      }
      subscription.unsubscribe();
    };
  }, [watch]);

  // Sync invitation/bootstrap mode from query results
  useEffect(() => {
    if (bootstrapQuery.isLoading) return;

    if (bootstrapQuery.isError) {
      setInvitationError('No fue posible cargar el estado de registro.');
      return;
    }

    const hasAdmin = bootstrapQuery.data?.hasAdmin;

    if (hasAdmin) {
      setRequiresBootstrapToken(false);

      // Only confirm "invitation mode" (and show the "Invitación validada" badges)
      // once a valid invitation is actually loaded — otherwise the badges would
      // contradict the "Necesita una invitación válida" warning.
      if (!invitationTokenFromQuery) {
        setIsInvitationMode(false);
        setInvitationError('Necesita una invitación válida para crear una cuenta.');
        setAvailableRoles([]);
        return;
      }

      if (invitationQuery.isLoading) return;

      if (invitationQuery.isError) {
        setIsInvitationMode(false);
        setAvailableRoles([]);
        setInvitationError('La invitación es inválida o expiró.');
        return;
      }

      if (invitationQuery.data) {
        const { role, email } = invitationQuery.data;
        setIsInvitationMode(true);
        setInvitationToken(invitationTokenFromQuery);
        setInvitationEmail(email);
        setAvailableRoles([role]);
        setValue('role', role, { shouldValidate: false, shouldDirty: false });
        setValue('email', email, { shouldValidate: false, shouldDirty: false });
        setInvitationError(null);
      }
    } else {
      setIsInvitationMode(false);
      setRequiresBootstrapToken(Boolean(bootstrapQuery.data?.requiresBootstrapToken));
      setInvitationToken(null);
      setInvitationEmail(null);
      setAvailableRoles(['ADMIN']);
      setValue('role', 'ADMIN', { shouldValidate: false, shouldDirty: false });
      setInvitationError(null);
    }
  }, [
    bootstrapQuery.isLoading,
    bootstrapQuery.isError,
    bootstrapQuery.data,
    invitationQuery.isLoading,
    invitationQuery.isError,
    invitationQuery.data,
    invitationTokenFromQuery,
    setValue,
  ]);

  const termsDocument = getLegalDocumentByType(legalDocumentsQuery.data, 'TERMS');
  const privacyDocument = getLegalDocumentByType(legalDocumentsQuery.data, 'PRIVACY');
  const legalDocumentsReady = Boolean(termsDocument?.version && privacyDocument?.version);
  const isLoadingRoles = bootstrapQuery.isLoading || invitationQuery.isLoading;
  const isFormBusy = isSubmitting || isLoadingRoles || legalDocumentsQuery.isLoading;

  const onSubmit = async (data: RegisterForm) => {
    setSubmitError(null);

    if (!termsDocument || !privacyDocument) {
      notify.error('No hay documentos legales vigentes publicados para completar el registro.');
      return;
    }

    const bootstrapToken = data.bootstrapToken?.trim();

    if (requiresBootstrapToken && !bootstrapToken) {
      setError('bootstrapToken', {
        type: 'manual',
        message: 'Ingresa el token de instalación para habilitar el primer administrador.',
      });
      return;
    }

    try {
      const registerResponse = await api.post('/auth/register', {
        email: data.email,
        password: data.password,
        nombre: data.nombre,
        role: data.role,
        invitationToken: invitationToken || undefined,
        bootstrapToken: requiresBootstrapToken ? bootstrapToken : undefined,
        acceptedTermsVersion: termsDocument.version,
        acceptedPrivacyVersion: privacyDocument.version,
      });

      const sessionUser = registerResponse.data.user;
      login(toAuthUser(sessionUser));
      stashAuthSessionPrefill(sessionUser);

      if (typeof window !== 'undefined') {
        if (registerDraftWriteTimerRef.current) {
          clearTimeout(registerDraftWriteTimerRef.current);
          registerDraftWriteTimerRef.current = null;
        }
        pendingRegisterDraftRef.current = null;
        window.sessionStorage.removeItem(REGISTER_DRAFT_KEY);
      }

      notify.success(feedbackCopy.accountCreated);
      router.push('/');
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  return {
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    availableRoles,
    invitationEmail,
    invitationError,
    isInvitationMode,
    requiresBootstrapToken,
    submitError,
    isLoadingRoles,
    isFormBusy,
    legalDocumentsReady,
    legalDocumentsQuery,
    termsDocument,
    privacyDocument,
    register,
    handleSubmit,
    clearErrors,
    errors,
    isSubmitting,
    onSubmit,
  };
}
