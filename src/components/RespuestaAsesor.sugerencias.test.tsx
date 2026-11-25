import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RespuestaAsesor, SeguimientosAsesor } from './RespuestaAsesor';
import { serializarRespuestaVisual } from '../lib/bloquesAsesor';

const hallazgo = {
  id: 'concentracion:salud:2026-11',
  tono: 'neutral' as const,
  titulo: 'Salud se llevó el 92 % de tus gastos',
  detalle: 'Casi todo lo que salió fue a una sola categoría.',
  pregunta: 'Ayúdame a ponerle tope a Salud',
};

describe('sugerencias del Asesor', () => {
  it('muestra lo que Luki notó y su pregunta envía la consulta', () => {
    const onPreguntar = vi.fn();
    render(<RespuestaAsesor texto="Vas bien." hallazgo={hallazgo} onPreguntar={onPreguntar} />);
    expect(screen.getByText('Algo que noté')).toBeTruthy();
    expect(screen.getByText(hallazgo.titulo)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ayúdame a ponerle tope a Salud/ }));
    expect(onPreguntar).toHaveBeenCalledWith('Ayúdame a ponerle tope a Salud');
  });

  it('el SuperAdmin ve el hallazgo de un mensaje guardado', () => {
    render(<RespuestaAsesor texto={serializarRespuestaVisual({ texto: 'Hola', bloques: [], hallazgo })} />);
    expect(screen.getByText(hallazgo.titulo)).toBeTruthy();
  });

  it('cada pregunta para seguir se envía tal cual', () => {
    const onElegir = vi.fn();
    render(<SeguimientosAsesor seguimientos={['¿Cómo bajo lo de Salud?', 'Ayúdame a crear una meta']} onElegir={onElegir} />);
    expect(screen.getByText('Sigue explorando')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ayúdame a crear una meta/ }));
    expect(onElegir).toHaveBeenCalledWith('Ayúdame a crear una meta');
  });
});
