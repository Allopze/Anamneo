import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnamnesisRemotaSection from '@/components/sections/AnamnesisRemotaSection';

function getFieldTextarea(labelText: RegExp) {
  const label = screen.getByText(labelText, { selector: 'label' });
  const container = label.closest('.space-y-2')!;
  return within(container as HTMLElement).getByRole('textbox');
}

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

    expect(
      getFieldTextarea(/Antecedentes médicos/i),
    ).toBeDisabled();

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

  it('keeps history chips when adding extra text to the local encounter copy', async () => {
    const onChange = jest.fn();

    render(
      <AnamnesisRemotaSection
        data={{
          antecedentesMedicos: {
            items: ['HTA'],
            texto: 'En tratamiento.',
          },
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(
      getFieldTextarea(/Antecedentes médicos/i),
      { target: { value: 'En tratamiento. Controlado' } },
    );

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        antecedentesMedicos: {
          items: ['HTA'],
          texto: 'En tratamiento. Controlado',
        },
      }),
    );
  });

  it('keeps the section editable when the data is already a local encounter copy', () => {
    render(
      <AnamnesisRemotaSection
        data={{
          readonly: false,
          antecedentesMedicos: {
            texto: 'Seguimiento local',
          },
        }}
        onChange={jest.fn()}
      />,
    );

    expect(
      getFieldTextarea(/Antecedentes médicos/i),
    ).toBeEnabled();
    expect(screen.queryByText(/Snapshot cargado desde el historial del paciente/i)).not.toBeInTheDocument();
  });
});
