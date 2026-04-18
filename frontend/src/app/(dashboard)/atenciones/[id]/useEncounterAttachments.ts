import { useEffect, useState } from 'react';
import { useMutation, useQuery, type QueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import type { Attachment, SectionKey } from '@/types';
import toast from 'react-hot-toast';

interface UploadMetaState {
  category: string;
  description: string;
  linkedOrderType: string;
  linkedOrderId: string;
}

interface UseEncounterAttachmentsParams {
  id: string;
  queryClient: QueryClient;
  currentSectionKey?: SectionKey;
}

export function useEncounterAttachments(params: UseEncounterAttachmentsParams) {
  const { id, queryClient, currentSectionKey } = params;
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMeta, setUploadMeta] = useState<UploadMetaState>({
    category: 'GENERAL',
    description: '',
    linkedOrderType: '',
    linkedOrderId: '',
  });
  const [showDeleteAttachment, setShowDeleteAttachment] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const attachmentsQuery = useQuery({
    queryKey: ['attachments', id],
    queryFn: async () => {
      const response = await api.get(`/attachments/encounter/${id}`);
      return response.data as Attachment[];
    },
    enabled: isAttachmentsOpen || currentSectionKey === 'TRATAMIENTO',
    staleTime: 30_000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', uploadMeta.category);
      formData.append('description', uploadMeta.description);

      if (uploadMeta.linkedOrderType && uploadMeta.linkedOrderId) {
        formData.append('linkedOrderType', uploadMeta.linkedOrderType);
        formData.append('linkedOrderId', uploadMeta.linkedOrderId);
      }

      return api.post(`/attachments/encounter/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      toast.success('Archivo adjuntado');
      setSelectedFile(null);
      setUploadMeta({ category: 'GENERAL', description: '', linkedOrderType: '', linkedOrderId: '' });
      queryClient.invalidateQueries({ queryKey: ['attachments', id] });
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setUploadError(message);
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => api.delete(`/attachments/${attachmentId}`),
    onSuccess: () => {
      toast.success('Archivo movido a papelera');
      setShowDeleteAttachment(null);
      queryClient.invalidateQueries({ queryKey: ['attachments', id] });
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  useEffect(() => {
    if (!isAttachmentsOpen) {
      setSelectedFile(null);
      setUploadError(null);
      setUploadMeta({ category: 'GENERAL', description: '', linkedOrderType: '', linkedOrderId: '' });
    }
  }, [isAttachmentsOpen]);

  const handleDownload = async (attachment: Attachment) => {
    try {
      const response = await api.get(`/attachments/${attachment.id}/download`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: attachment.mime });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.originalName || 'archivo';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleStartLinkedAttachment = (type: 'EXAMEN' | 'DERIVACION', orderId: string) => {
    setUploadError(null);
    setSelectedFile(null);
    setUploadMeta((previous) => ({
      ...previous,
      category: type,
      linkedOrderType: type,
      linkedOrderId: orderId,
    }));
    setIsAttachmentsOpen(true);
  };

  return {
    isAttachmentsOpen,
    setIsAttachmentsOpen,
    selectedFile,
    setSelectedFile,
    uploadError,
    setUploadError,
    uploadMeta,
    setUploadMeta,
    showDeleteAttachment,
    setShowDeleteAttachment,
    previewAttachment,
    setPreviewAttachment,
    attachments: attachmentsQuery.data ?? [],
    attachmentsQuery,
    uploadMutation,
    deleteMutation,
    handleDownload,
    handleStartLinkedAttachment,
  };
}
