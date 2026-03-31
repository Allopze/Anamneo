import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IdentificacionSection from '@/components/sections/IdentificacionSection';

describe('IdentificacionSection', () => {
  it('offers snapshot restoration when patient master data diverges', async () => {
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

    expect(screen.getByText(/Se detectó divergencia con la ficha maestra/i)).toBeInTheDocument();
    expect(screen.getByText(/previsión, domicilio/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Restaurar desde ficha maestra/i }));

    expect(onRestoreFromPatient).toHaveBeenCalledTimes(1);
  });
});
