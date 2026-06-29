import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConditionSelector from '@/components/common/ConditionSelector';

const apiGetMock = jest.fn();
const apiPostMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: (...args: any[]) => apiPostMock(...args),
  },
}));

describe('ConditionSelector', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    apiGetMock.mockResolvedValue({ data: [] });
    apiPostMock.mockResolvedValue({ data: { id: 'cond-1' } });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('adds manual entries only to the current history by default', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<ConditionSelector selected={[]} onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'asma');
    act(() => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/conditions?search=asma');
    });

    await user.click(screen.getByRole('button', { name: /Agregar solo al historial/i }));

    expect(onChange).toHaveBeenCalledWith(['asma']);
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it('persists manual additions only through the explicit catalog action', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <ConditionSelector
        selected={[]}
        onChange={onChange}
        allowCatalogPersistence
      />,
    );

    await user.type(screen.getByRole('textbox'), 'migraña');
    act(() => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/conditions?search=migra%C3%B1a');
    });

    await user.click(screen.getByRole('button', { name: /Agregar también al catálogo local/i }));

    expect(onChange).toHaveBeenCalledWith(['migraña']);
    expect(apiPostMock).toHaveBeenCalledWith('/conditions/local', { name: 'migraña' });
  });
});