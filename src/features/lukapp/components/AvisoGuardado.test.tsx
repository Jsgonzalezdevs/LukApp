import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvisoGuardado } from './AvisoGuardado';

describe('AvisoGuardado', () => {
  it('no ofrece un deshacer falso para operaciones financieras compuestas', () => {
    render(
      <AvisoGuardado
        guardado={{ id: 'voz', texto: 'Abono guardado', permitirDeshacer: false }}
        onDeshacer={vi.fn()}
        onCerrar={vi.fn()}
      />,
    );
    expect(screen.getByText('Abono guardado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deshacer/ })).not.toBeInTheDocument();
  });
});
