import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RevisionSistemasSection from '@/components/sections/RevisionSistemasSection';

describe('RevisionSistemasSection', () => {
  it('does not mark the negative option by default when there is no data', () => {
    render(<RevisionSistemasSection data={{}} onChange={jest.fn()} />);

    expect(
      screen.getByRole('button', { name: /revisión por sistemas negativa/i }),
    ).toHaveTextContent('Revisión por sistemas negativa');
    expect(screen.queryByText(/se registrará que la revisión por sistemas es negativa/i)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /psíquico/i })).toBeInTheDocument();
  });

  it('persists the explicit negative flag when the user marks nothing to report', async () => {
    const onChange = jest.fn();

    render(<RevisionSistemasSection data={{}} onChange={onChange} />);

    await userEvent.click(
      screen.getByRole('button', { name: /revisión por sistemas negativa/i }),
    );

    expect(onChange).toHaveBeenCalledWith({ negativa: true });
  });
});
