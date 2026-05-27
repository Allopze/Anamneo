'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { type Appointment, type AppointmentForm, type AppointmentStatus } from './agenda-types';

interface UseAgendaAppointmentsParams {
  medicoId: string;
  weekStart: Date;
  weekEnd: Date;
  form: AppointmentForm;
  selectedPatientId: string | null | undefined;
  onCreateSuccess: () => void;
  onMutationSuccess: () => void;
}

export function useAgendaAppointments({
  medicoId,
  weekStart,
  weekEnd,
  form,
  selectedPatientId,
  onCreateSuccess,
  onMutationSuccess,
}: UseAgendaAppointmentsParams) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const queryKey = ['appointments', medicoId, weekStart.toISOString()];

  const { data: appointmentsData, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get<{ appointments: Appointment[]; truncated: boolean }>('/appointments', {
        params: {
          medicoId,
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString(),
        },
      });
      return res.data;
    },
    enabled: Boolean(medicoId),
    staleTime: 30_000,
  });

  const appointments = appointmentsData?.appointments ?? [];
  const truncated = appointmentsData?.truncated ?? false;

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: async () => {
      const start = new Date(`${form.startDate}T${form.startTime}:00`);
      const end = new Date(`${form.startDate}T${form.endTime}:00`);
      await api.post('/appointments', {
        medicoId,
        patientId: selectedPatientId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        title: form.title.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Cita creada');
      onCreateSuccess();
      void invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      await api.put(`/appointments/${id}`, { status });
    },
    onSuccess: () => {
      toast.success('Estado actualizado');
      onMutationSuccess();
      void invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const attendMutation = useMutation({
    mutationFn: async (appt: Appointment) => {
      if (!appt.patientId) {
        throw new Error('La cita debe estar vinculada a un paciente antes de atender');
      }
      const response = await api.post(`/encounters/patient/${appt.patientId}`, {
        appointmentId: appt.id,
      });
      return response.data as { id: string; reused?: boolean };
    },
    onSuccess: async (encounter) => {
      toast.success(encounter.reused ? 'Atención en curso asociada a la cita' : 'Atención creada desde la cita');
      onMutationSuccess();
      await invalidate();
      router.push(`/atenciones/${encounter.id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/appointments/${id}`, { data: {} });
    },
    onSuccess: () => {
      toast.success('Cita cancelada');
      onMutationSuccess();
      void invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return { appointments, isLoading, truncated, createMutation, updateMutation, attendMutation, cancelMutation };
}
