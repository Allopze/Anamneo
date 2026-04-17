import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MotivoConsultaSection from '@/components/sections/MotivoConsultaSection';

const apiPostMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

jest.mock('@/components/common/VoiceDictationButton', () => function VoiceDictationButtonMock() {
  return null;
});

describe('MotivoConsultaSection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('logs manual fallback when the user rejects the suggested conditions', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const suggestions = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Migraña',
        score: 12,
        confidence: 95,
        reasons: [{ kind: 'NAME', label: 'Nombre', matchedValue: 'Migraña', matches: ['migraña'] }],
      },
    ];
    apiPostMock
      .mockResolvedValueOnce({ data: suggestions })
      .mockResolvedValueOnce({ data: { ok: true } });

    render(
      <MotivoConsultaSection
        data={{ texto: 'dolor de cabeza intenso' }}
        onChange={onChange}
        encounter={{ id: 'enc-1' } as never}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(550);
    });

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/conditions/suggest', {
        text: 'dolor de cabeza intenso',
        limit: 3,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Migraña')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /mantener selección manual/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        modoSeleccion: 'MANUAL',
        afeccionSeleccionada: null,
      }),
    );
    expect(apiPostMock).toHaveBeenLastCalledWith('/conditions/encounters/enc-1/suggestion', {
      inputText: 'dolor de cabeza intenso',
      persistedTextSnapshot: 'dolor de cabeza intenso',
      suggestions,
      chosenConditionId: null,
      chosenMode: 'MANUAL',
    });
    expect(screen.getByText(/Por qué aparece Migraña/i)).toBeInTheDocument();
  });

  it('does not auto-select again when manual mode is already active', async () => {
    const onChange = jest.fn();
    apiPostMock.mockResolvedValueOnce({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Migraña',
          score: 12,
          confidence: 95,
          reasons: [{ kind: 'NAME', label: 'Nombre', matchedValue: 'Migraña', matches: ['migraña'] }],
        },
      ],
    });

    render(
      <MotivoConsultaSection
        data={{ texto: 'dolor de cabeza intenso', modoSeleccion: 'MANUAL', afeccionSeleccionada: null }}
        onChange={onChange}
        encounter={{ id: 'enc-1' } as never}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(550);
    });

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/conditions/suggest', {
        text: 'dolor de cabeza intenso',
        limit: 3,
      });
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
