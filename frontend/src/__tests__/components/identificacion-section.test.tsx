import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IdentificacionSection from '@/components/sections/IdentificacionSection';

describe('IdentificacionSection', () => {
  it('offers updating the encounter identification from the patient record', async () => {
    const onRestoreFromPatient = jest.fn();

    render(
      <IdentificacionSection
        data={{
          nombre: 'Paciente Demo',
          edad: 44,
          sexo: 'FEMENINO',
          prevision: 'FONASA',
        }}
        onChange={jest.fn()}
        readOnly
        snapshotStatus={{
          isSnapshot: true,
          hasDifferences: true,
          differingFields: ['prevision', 'domicilio'],
          differingFieldLabels: ['previsión', 'domicilio'],
          snapshotCreatedAt: '2026-03-31T10:00:00.000Z',
          sourcePatientUpdatedAt: '2026-03-31T10:05:00.000Z',
        }}
        onRestoreFromPatient={onRestoreFromPatient}
      />,
    );

    expect(screen.getByText(/Estos datos no coinciden con la ficha del paciente/i)).toBeInTheDocument();
    expect(screen.getByText(/previsión, domicilio/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Actualizar con datos de la ficha/i }));

    expect(onRestoreFromPatient).toHaveBeenCalledTimes(1);
  });
});
