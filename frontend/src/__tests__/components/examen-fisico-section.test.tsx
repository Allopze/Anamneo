import { render, screen } from '@testing-library/react';
import ExamenFisicoSection from '@/components/sections/ExamenFisicoSection';

describe('ExamenFisicoSection', () => {
  it('separates local warnings from automatic clinical alerts', () => {
    render(
      <ExamenFisicoSection
        data={{
          signosVitales: {
            presionArterial: '150/95',
            temperatura: '39.6',
            saturacionOxigeno: '91',
          },
        }}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText('Valores críticos con posible alerta clínica automática')).toBeInTheDocument();
    expect(screen.getByText(/Anamneo intentará crear una alerta clínica automática/i)).toBeInTheDocument();
    expect(screen.getByText(/Temperatura crítica: 39.6°C/i)).toBeInTheDocument();

    expect(screen.getByText('Advertencias locales')).toBeInTheDocument();
    expect(screen.getByText(/no generan una alerta clínica automática por sí solos/i)).toBeInTheDocument();
    expect(screen.getByText(/Presión arterial elevada: 150\/95/i)).toBeInTheDocument();
    expect(screen.getByText(/Saturación de oxígeno baja: 91%/i)).toBeInTheDocument();
  });
});