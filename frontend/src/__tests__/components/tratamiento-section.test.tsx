import { act, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import TratamientoSection from '@/components/sections/TratamientoSection';
import { TratamientoData } from '@/types';

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
}: {
  initialData: TratamientoData;
  onChange?: jest.Mock;
}) {
  const [data, setData] = useState<TratamientoData>(initialData);

  return (
    <TratamientoSection
      data={data}
      onChange={(next) => {
        setData(next);
        onChange?.(next);
      }}
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
          }),
        ],
      }),
    );
  });
});
