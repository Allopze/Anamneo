import { render, screen } from '@testing-library/react';
import EncounterAttachmentsModal from '@/app/(dashboard)/atenciones/[id]/EncounterAttachmentsModal';

describe('EncounterAttachmentsModal', () => {
  const baseProps = {
    canUpload: false,
    canDeleteAttachments: false,
    selectedFile: null,
    setSelectedFile: jest.fn(),
    uploadError: null,
    setUploadError: jest.fn(),
    uploadMeta: {
      category: 'GENERAL',
      description: '',
      linkedOrderType: '',
      linkedOrderId: '',
    },
    setUploadMeta: jest.fn(),
    attachments: [
      {
        id: 'att-1',
        originalName: 'resultado.pdf',
        mime: 'application/pdf',
        size: 2048,
        category: 'EXAMEN',
        description: 'Resultado adjunto',
        uploadedAt: '2026-04-16T10:00:00.000Z',
        uploadedBy: { nombre: 'Dra. Rivera' },
      },
    ],
    attachmentsQuery: {
      isLoading: false,
      error: null,
    } as any,
    currentLinkedOrderType: '',
    currentLinkableOrders: [],
    uploadMutation: {
      isPending: false,
      mutate: jest.fn(),
    } as any,
    deleteMutation: {
      isPending: false,
      mutate: jest.fn(),
    } as any,
    handleDownload: jest.fn(),
    setIsAttachmentsOpen: jest.fn(),
    showDeleteAttachment: null,
    setShowDeleteAttachment: jest.fn(),
    setPreviewAttachment: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides upload and delete affordances when the encounter attachments are immutable', () => {
    render(<EncounterAttachmentsModal {...(baseProps as any)} />);

    expect(screen.queryByLabelText('Archivo')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar' })).toBeInTheDocument();
  });
});