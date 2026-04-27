import { fireEvent, render, screen } from '@testing-library/react';
import AnamnesisProximaSection from '@/components/sections/AnamnesisProximaSection';

jest.mock('@/components/common/VoiceDictationButton', () => function VoiceDictationButtonMock() {
  return null;
});

describe('AnamnesisProximaSection', () => {
  it('associates the main clinical fields with accessible labels', () => {
    render(
      <AnamnesisProximaSection
        data={{
          relatoAmpliado: 'Dolor abdominal desde ayer.',
          inicio: 'Ayer',
          evolucion: 'Intermitente',
          perfilDolorAbdominal: {
            asociadoComida: 'NO_CLARO',
          },
        }}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Relato ampliado')).toHaveValue('Dolor abdominal desde ayer.');
    expect(screen.getByLabelText('Inicio')).toHaveValue('Ayer');
    expect(screen.getByLabelText('Evolución')).toHaveValue('Intermitente');
    expect(screen.getByLabelText('¿Asociado a comida?')).toHaveValue('NO_CLARO');
  });

  it('updates structured abdominal symptoms as pressed controls', () => {
    const onChange = jest.fn();

    render(
      <AnamnesisProximaSection
        data={{ perfilDolorAbdominal: { vomitos: false } }}
        onChange={onChange}
      />,
    );

    const vomitos = screen.getByRole('button', { name: 'Vómitos' });
    expect(vomitos).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(vomitos);

    expect(onChange).toHaveBeenCalledWith({
      perfilDolorAbdominal: {
        vomitos: true,
      },
    });
  });
});
