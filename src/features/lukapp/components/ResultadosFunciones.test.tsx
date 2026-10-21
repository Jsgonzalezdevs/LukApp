import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResultadosFunciones } from './ResultadosFunciones';

describe('búsqueda de funciones', () => {
  it('dice dónde vive una función y abre su ruta real', () => {
    const abrir = vi.fn();
    render(<ResultadosFunciones texto="metas" onAbrir={abrir} />);
    fireEvent.click(screen.getByRole('button', { name: /Metas de ahorro/ }));
    expect(abrir).toHaveBeenCalledWith('/dinero/metas');
    expect(screen.getByText(/Dinero ·/)).toBeInTheDocument();
  });
});
