import {
  buildEncounterCompletionChecklist,
  buildEncounterSignatureDiff,
  buildEncounterSignatureSummary,
  buildRequiredWorkflowNoteError,
  hasRequiredWorkflowNote,
  normalizeClosureNoteForCompletion,
  normalizeReviewNoteForWorkflow,
} from '@/lib/encounter-completion';

describe('encounter completion helpers', () => {
  it('normalizes the closure note before sending it to the API', () => {
    expect(normalizeClosureNoteForCompletion('  Cierre clínico suficiente.  ')).toBe(
      'Cierre clínico suficiente.',
    );
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeClosureNoteForCompletion('   ')).toBe('');
  });

  it('normalizes review notes before workflow mutations', () => {
    expect(normalizeReviewNoteForWorkflow('  Revisión final suficiente.  ')).toBe('Revisión final suficiente.');
  });

  it('validates required workflow notes using the shared minimum length', () => {
    expect(hasRequiredWorkflowNote('corta')).toBe(false);
    expect(hasRequiredWorkflowNote('Nota clínica suficiente.')).toBe(true);
  });

  it('builds the same validation message expected from workflow actions', () => {
    expect(buildRequiredWorkflowNoteError('La nota de cierre')).toBe('La nota de cierre debe tener al menos 10 caracteres');
  });

  it('builds a pre-close checklist with explicit blockers', () => {
    const checklist = buildEncounterCompletionChecklist(
      {
        clinicalOutputBlock: {
          completenessStatus: 'PENDIENTE_VERIFICACION',
          missingFields: [],
          blockedActions: ['COMPLETE_ENCOUNTER'],
          reason: 'La ficha del paciente sigue pendiente de verificación médica.',
        },
        sections: [
          { sectionKey: 'IDENTIFICACION', completed: true, data: { nombre: 'Paciente Demo' } },
          { sectionKey: 'MOTIVO_CONSULTA', completed: true, data: { texto: 'Cefalea' } },
          { sectionKey: 'EXAMEN_FISICO', completed: false, data: {} },
          { sectionKey: 'SOSPECHA_DIAGNOSTICA', completed: true, data: { sospechas: [] } },
          { sectionKey: 'TRATAMIENTO', completed: true, data: { plan: '' } },
        ],
      } as any,
      'corta',
    );

    expect(checklist.map((item) => item.status)).toEqual(['blocked', 'blocked', 'blocked', 'blocked']);
    expect(checklist[0].detail).toContain('Examen físico');
    expect(checklist[1].detail).toContain('Sospecha diagnóstica');
    expect(checklist[2].detail).toContain('al menos 10 caracteres');
    expect(checklist[3].detail).toContain('pendiente de verificación médica');
  });

  it('summarizes the data that will be included in the signature flow', () => {
    const summary = buildEncounterSignatureSummary({
      reviewStatus: 'REVISADA_POR_MEDICO',
      closureNote: 'Paciente estable al cierre.',
      attachments: [{ id: 'att-1' }, { id: 'att-2' }],
      sections: [
        { id: 'sec-1', completed: true },
        { id: 'sec-2', completed: false },
      ],
    } as any);

    expect(summary).toEqual([
      expect.objectContaining({ id: 'sections', value: '1/2' }),
      expect.objectContaining({ id: 'review', value: 'Revisada por médico' }),
      expect.objectContaining({ id: 'closure-note', value: 'Incluida' }),
      expect.objectContaining({ id: 'attachments', value: '2 adjuntos' }),
    ]);
  });

  it('builds a field-level diff against the previous comparable encounter before signing', () => {
    const diff = buildEncounterSignatureDiff({
      sections: [
        {
          sectionKey: 'MOTIVO_CONSULTA',
          label: 'Motivo de consulta',
          data: { texto: 'Cefalea con náuseas' },
        },
        {
          sectionKey: 'TRATAMIENTO',
          label: 'Tratamiento',
          data: { plan: 'Reposo e hidratación' },
        },
      ],
      attachments: [
        {
          id: 'att-2',
          originalName: 'control.pdf',
          mime: 'application/pdf',
          size: 123,
          uploadedAt: '2026-04-17T10:00:00.000Z',
        },
      ],
      signatureBaseline: {
        id: 'enc-prev',
        status: 'FIRMADO',
        createdAt: '2026-04-10T10:00:00.000Z',
        sections: [
          {
            sectionKey: 'MOTIVO_CONSULTA',
            label: 'Motivo de consulta',
            data: { texto: 'Cefalea' },
          },
        ],
        attachments: [],
      },
    } as any);

    expect(diff.baselineEncounterId).toBe('enc-prev');
    expect(diff.hasChanges).toBe(true);
    expect(diff.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sectionKey: 'MOTIVO_CONSULTA',
          fieldChanges: expect.arrayContaining([
            expect.objectContaining({
              label: 'Texto',
              before: 'Cefalea',
              after: 'Cefalea con náuseas',
            }),
          ]),
        }),
        expect.objectContaining({
          sectionKey: 'TRATAMIENTO',
          status: 'new',
        }),
      ]),
    );
    expect(diff.attachmentChanges).toEqual([{ kind: 'added', label: 'control.pdf' }]);
  });
});
