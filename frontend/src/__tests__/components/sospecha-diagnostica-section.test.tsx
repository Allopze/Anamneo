import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SospechaDiagnosticaSection from '@/components/sections/SospechaDiagnosticaSection';
import type { SospechaDiagnosticaData } from '@/types';

const apiGetMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

// Controlled wrapper so onChange actually updates the rendered data
function Controlled({ initial = { sospechas: [] } }: { initial?: SospechaDiagnosticaData }) {
  const [data, setData] = React.useState<SospechaDiagnosticaData>(initial);
  return <SospechaDiagnosticaSection data={data} onChange={setData} />;
}

// Pre-built data with one sospecha so CIE-10 input is immediately visible
const DATA_WITH_SOSPECHA: SospechaDiagnosticaData = {
  sospechas: [{ id: 's1', diagnostico: 'Dolor torácico', codigoCie10: undefined, descripcionCie10: undefined, prioridad: 1, notas: '' }],
};

function getCie10Input() {
  return screen.getByPlaceholderText('Buscar código CIE-10...');
}

describe('SospechaDiagnosticaSection — CIE-10 timer cleanup', () => {
  let setTimeoutSpy: jest.SpyInstance;
  let clearTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    apiGetMock.mockResolvedValue({ data: [] });
    setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it('schedules a debounce timer when the CIE-10 query has at least 2 characters', () => {
    render(<SospechaDiagnosticaSection data={DATA_WITH_SOSPECHA} onChange={jest.fn()} />);

    fireEvent.change(getCie10Input(), { target: { value: 'ap' } });

    const debounceCalls = setTimeoutSpy.mock.calls.filter(([, delay]) => delay >= 200);
    expect(debounceCalls.length).toBeGreaterThan(0);
  });

  it('does not schedule a debounce timer for queries shorter than 2 characters', () => {
    render(<SospechaDiagnosticaSection data={DATA_WITH_SOSPECHA} onChange={jest.fn()} />);

    fireEvent.change(getCie10Input(), { target: { value: 'a' } });

    const debounceCalls = setTimeoutSpy.mock.calls.filter(([, delay]) => delay >= 200);
    expect(debounceCalls).toHaveLength(0);
  });

  it('cancels the previous debounce timer when a new character is typed before it fires', () => {
    render(<SospechaDiagnosticaSection data={DATA_WITH_SOSPECHA} onChange={jest.fn()} />);
    const input = getCie10Input();

    fireEvent.change(input, { target: { value: 'ap' } });
    fireEvent.change(input, { target: { value: 'ape' } });

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('calls clearTimeout for pending timers when the component unmounts', () => {
    const { unmount } = render(
      <SospechaDiagnosticaSection data={DATA_WITH_SOSPECHA} onChange={jest.fn()} />,
    );

    fireEvent.change(getCie10Input(), { target: { value: 'ap' } });

    const clearBefore = clearTimeoutSpy.mock.calls.length;

    act(() => { unmount(); });

    // The cleanup effect must cancel pending timers on unmount
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(clearBefore);
  });

  it('does not throw when unmounted with no pending timers', () => {
    const { unmount } = render(
      <SospechaDiagnosticaSection data={{ sospechas: [] }} onChange={jest.fn()} />,
    );

    expect(() => act(() => { unmount(); })).not.toThrow();
  });

  it('calls the CIE-10 search API after the debounce fires', async () => {
    apiGetMock.mockResolvedValue({ data: [{ code: 'K35', description: 'Apendicitis aguda' }] });

    render(<SospechaDiagnosticaSection data={DATA_WITH_SOSPECHA} onChange={jest.fn()} />);
    fireEvent.change(getCie10Input(), { target: { value: 'ap' } });

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/cie10/search', { params: { q: 'ap', limit: 8 } });
    }, { timeout: 800 });
  });

  it('adds a new sospecha to the list via the controlled wrapper and shows CIE-10 input', async () => {
    render(<Controlled />);

    expect(screen.queryByPlaceholderText('Buscar código CIE-10...')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /agregar sospecha diagnóstica/i }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Buscar código CIE-10...')).toBeInTheDocument(),
    );
  });
});
