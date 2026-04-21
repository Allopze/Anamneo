import { act, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import TratamientoSection from '@/components/sections/TratamientoSection';
import { SospechaDiagnosticaData, TratamientoData } from '@/types';

const apiGetMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
}));

jest.mock('@/components/common/VoiceDictationButton', () => function VoiceDictationButtonMock() {
  return null;
});

jest.mock('@/components/sections/LinkedAttachmentBlock', () => function LinkedAttachmentBlockMock() {
  return null;
});

function StatefulTratamientoSection({
  initialData,
  onChange,
  diagnosticData,
}: {
  initialData: TratamientoData;
  onChange?: jest.Mock;
  diagnosticData?: SospechaDiagnosticaData;
}) {
  const [data, setData] = useState<TratamientoData>(initialData);

  return (
    <TratamientoSection
      data={data}
      onChange={(next) => {
        setData(next);
        onChange?.(next);
      }}
      diagnosticData={diagnosticData}
    />
  );
}

describe('TratamientoSection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    apiGetMock.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('keeps spaces while editing the treatment plan', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<StatefulTratamientoSection initialData={{}} onChange={onChange} />);

    const textarea = screen.getAllByRole('textbox')[0];

    await user.type(textarea, 'Reposo relativo');

    expect(textarea).toHaveValue('Reposo relativo');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        plan: 'Reposo relativo',
      }),
    );
  });

  it('uses legacy indicaciones as initial text and migrates edits to plan', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <StatefulTratamientoSection
        initialData={{ indicaciones: 'Control en 48 horas' }}
        onChange={onChange}
      />,
    );

    const textarea = screen.getAllByRole('textbox')[0];
    expect(textarea).toHaveValue('Control en 48 horas');

    await user.type(textarea, '.');

    expect(onChange).toHaveBeenLastCalledWith({
      plan: 'Control en 48 horas.',
    });
  });

  it('fills the active ingredient when a catalog medication is selected', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    apiGetMock.mockResolvedValue({
      data: [
        {
          id: 'med-1',
          name: 'Omeprazol MK',
          activeIngredient: 'Omeprazol',
          defaultDose: '40 mg',
          defaultRoute: 'ORAL',
          defaultFrequency: 'cada 24 h',
          active: true,
        },
      ],
    });

    render(
      <StatefulTratamientoSection
        initialData={{
          medicamentosEstructurados: [
            {
              id: 'med-row-1',
              nombre: '',
              dosis: '',
              frecuencia: '',
              duracion: '',
            },
          ],
        }}
        onChange={onChange}
      />,
    );

    await user.type(screen.getByPlaceholderText('Medicamento'), 'ome');

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/medications?search=ome');
    });

    await user.click(await screen.findByRole('button', { name: /Omeprazol MK/i }));

    expect(await screen.findByText(/Principio activo catalogado: Omeprazol/i)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        medicamentosEstructurados: [
          expect.objectContaining({
            id: 'med-row-1',
            nombre: 'Omeprazol MK',
            activeIngredient: 'Omeprazol',
            dosis: '40 mg',
            via: 'ORAL',
            frecuencia: 'cada 24 h',
          }),
        ],
      }),
    );
  });

  it('does not overwrite dosage fields already filled in the encounter row', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    apiGetMock.mockResolvedValue({
      data: [
        {
          id: 'med-1',
          name: 'Omeprazol MK',
          activeIngredient: 'Omeprazol',
          defaultDose: '40 mg',
          defaultRoute: 'ORAL',
          defaultFrequency: 'cada 24 h',
          active: true,
        },
      ],
    });

    render(
      <StatefulTratamientoSection
        initialData={{
          medicamentosEstructurados: [
            {
              id: 'med-row-1',
              nombre: '',
              dosis: '10 mg',
              via: 'IV',
              frecuencia: 'cada 12 h',
              duracion: '',
            },
          ],
        }}
        onChange={onChange}
      />,
    );

    await user.type(screen.getByPlaceholderText('Medicamento'), 'ome');

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/medications?search=ome');
    });

    await user.click(await screen.findByRole('button', { name: /Omeprazol MK/i }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        medicamentosEstructurados: [
          expect.objectContaining({
            id: 'med-row-1',
            nombre: 'Omeprazol MK',
            activeIngredient: 'Omeprazol',
            dosis: '10 mg',
            via: 'IV',
            frecuencia: 'cada 12 h',
          }),
        ],
      }),
    );
  });

  it('stores the selected diagnostic suspicion on structured treatment rows', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <StatefulTratamientoSection
        initialData={{
          examenesEstructurados: [
            {
              id: 'exam-1',
              nombre: 'Hemograma',
              indicacion: 'Control',
              estado: 'PENDIENTE',
            },
          ],
        }}
        diagnosticData={{
          sospechas: [
            { id: 'dx-1', diagnostico: 'Gastritis aguda', prioridad: 1, notas: '' },
            { id: 'dx-2', diagnostico: 'Úlcera péptica', prioridad: 2, notas: '' },
          ],
        }}
        onChange={onChange}
      />
    );

    await user.selectOptions(screen.getByLabelText('Diagnóstico asociado del examen'), 'dx-2');

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        examenesEstructurados: [
          expect.objectContaining({
            id: 'exam-1',
            sospechaId: 'dx-2',
          }),
        ],
      }),
    );
  });
});
