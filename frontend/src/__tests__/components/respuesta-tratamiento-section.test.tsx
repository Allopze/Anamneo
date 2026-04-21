import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import RespuestaTratamientoSection from '@/components/sections/RespuestaTratamientoSection';
import { RespuestaTratamientoData, TratamientoData } from '@/types';

jest.mock('@/components/common/VoiceDictationButton', () => function VoiceDictationButtonMock() {
  return null;
});

function StatefulRespuestaTratamientoSection({
  initialData,
  treatmentData,
  onChange,
}: {
  initialData: RespuestaTratamientoData;
  treatmentData?: TratamientoData;
  onChange?: jest.Mock;
}) {
  const [data, setData] = useState<RespuestaTratamientoData>(initialData);

  return (
    <RespuestaTratamientoSection
      data={data}
      treatmentData={treatmentData}
      onChange={(next) => {
        setData(next);
        onChange?.(next);
      }}
    />
  );
}

describe('RespuestaTratamientoSection', () => {
  it('stores structured outcomes by treatment item id', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(
      <StatefulRespuestaTratamientoSection
        initialData={{}}
        treatmentData={{
          medicamentosEstructurados: [{ id: 'med-1', nombre: 'Omeprazol' }],
          examenesEstructurados: [{ id: 'exam-1', nombre: 'Hemograma', estado: 'PENDIENTE' }],
        }}
        onChange={onChange}
      />
    );

    await user.selectOptions(
      screen.getByLabelText('Desenlace estructurado de medicamento Omeprazol'),
      'FAVORABLE',
    );

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        resultadosTratamientos: [
          expect.objectContaining({
            treatmentItemId: 'med-1',
            estado: 'FAVORABLE',
          }),
        ],
      }),
    );
  });

  it('stores adherence and adverse event details by treatment item id', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(
      <StatefulRespuestaTratamientoSection
        initialData={{}}
        treatmentData={{
          medicamentosEstructurados: [{ id: 'med-1', nombre: 'Omeprazol' }],
        }}
        onChange={onChange}
      />
    );

    await user.selectOptions(screen.getByLabelText('Adherencia de medicamento Omeprazol'), 'NO_ADHERENTE');
    await user.selectOptions(screen.getByLabelText('Evento adverso de medicamento Omeprazol'), 'MODERADO');

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        resultadosTratamientos: [
          expect.objectContaining({
            treatmentItemId: 'med-1',
            adherenceStatus: 'NO_ADHERENTE',
            adverseEventSeverity: 'MODERADO',
          }),
        ],
      }),
    );
  });
});