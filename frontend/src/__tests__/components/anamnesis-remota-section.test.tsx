import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnamnesisRemotaSection from '@/components/sections/AnamnesisRemotaSection';

describe('AnamnesisRemotaSection', () => {
  it('lets the user decouple the encounter snapshot and navigate to master history', async () => {
    const onChange = jest.fn();

    render(
      <AnamnesisRemotaSection
        data={{
          readonly: true,
          antecedentesMedicos: {
            items: ['HTA'],
            texto: 'Hipertensión arterial controlada.',
          },
        }}
        onChange={onChange}
        patientId="patient-1"
        canEditPatientHistory
      />,
    );

    expect(screen.getByText(/Snapshot cargado desde el historial del paciente/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ir al historial maestro/i })).toHaveAttribute(
      'href',
      '/pacientes/patient-1/historial',
    );

    await userEvent.click(screen.getByRole('button', { name: /Editar solo esta atención/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        readonly: false,
      }),
    );
  });
});
