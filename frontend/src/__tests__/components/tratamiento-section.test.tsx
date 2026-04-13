import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TratamientoSection from '@/components/sections/TratamientoSection';
import { TratamientoData } from '@/types';

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
  it('keeps spaces while editing the treatment plan', async () => {
    const onChange = jest.fn();

    render(<StatefulTratamientoSection initialData={{}} onChange={onChange} />);

    const textarea = screen.getAllByRole('textbox')[0];

    await userEvent.type(textarea, 'Reposo relativo');

    expect(textarea).toHaveValue('Reposo relativo');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        plan: 'Reposo relativo',
      }),
    );
  });

  it('uses legacy indicaciones as initial text and migrates edits to plan', async () => {
    const onChange = jest.fn();

    render(
      <StatefulTratamientoSection
        initialData={{ indicaciones: 'Control en 48 horas' }}
        onChange={onChange}
      />,
    );

    const textarea = screen.getAllByRole('textbox')[0];
    expect(textarea).toHaveValue('Control en 48 horas');

    await userEvent.type(textarea, '.');

    expect(onChange).toHaveBeenLastCalledWith({
      plan: 'Control en 48 horas.',
    });
  });
});
