import debounce from '@/lib/debounce';

jest.useFakeTimers();

describe('debounce', () => {
  it('calls function after wait period', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on subsequent calls', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced();
    jest.advanceTimersByTime(200);
    debounced(); // reset
    jest.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to the original function', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced('a', 'b');
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('a', 'b');
  });

  it('only calls once for rapid successive invocations', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    for (let i = 0; i < 10; i++) {
      debounced();
    }

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
