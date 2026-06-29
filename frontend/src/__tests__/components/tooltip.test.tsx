import { act, fireEvent, render, screen } from '@testing-library/react';

import Tooltip from '@/components/common/Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders the tooltip bubble in a portal attached to document.body', () => {
    const { container } = render(
      <Tooltip label="Buscar paciente" side="right">
        <button type="button">Abrir búsqueda</button>
      </Tooltip>,
    );

    fireEvent.focus(screen.getByRole('button', { name: 'Abrir búsqueda' }));

    act(() => {
      jest.advanceTimersByTime(400);
    });

    const tooltip = screen.getByRole('tooltip');

    expect(document.body).toContainElement(tooltip);
    expect(container).not.toContainElement(tooltip);
  });
});