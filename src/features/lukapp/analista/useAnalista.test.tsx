import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnalista } from './useAnalista';

const { reconocer } = vi.hoisted(() => ({ reconocer: vi.fn() }));
vi.mock('tesseract.js', () => ({ default: { recognize: reconocer } }));

describe('useAnalista — formatos locales', () => {
  beforeEach(() => reconocer.mockReset());

  it('lee CSV en el dispositivo sin enviar una solicitud al servidor', async () => {
    const fetchOriginal = globalThis.fetch;
    const fetchEspia = vi.fn();
    globalThis.fetch = fetchEspia;
    try {
      const { result } = renderHook(() => useAnalista());
      const archivo = new File(['Fecha;Descripción;Débito\n20/10/2026;Café;4.500'], 'gastos.csv', { type: 'text/csv' });
      act(() => result.current.analizarArchivos([archivo]));
      await waitFor(() => expect(result.current.trabajos[0]?.fase).toBe('listo'));
      expect(result.current.trabajos[0]?.resultado?.movimientos[0]).toMatchObject({ descripcion: 'Café', montoCop: 4_500, tipo: 'gasto' });
      expect(fetchEspia).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it('pide revisar las cifras reconocidas de una foto antes de poder importar', async () => {
    reconocer.mockResolvedValue({ data: { text: '20/10/2026 COMPRA PANADERIA 15.500' } });
    const { result } = renderHook(() => useAnalista());
    const archivo = new File(['imagen falsa para la prueba'], 'extracto.png', { type: 'image/png' });
    act(() => result.current.analizarArchivos([archivo]));
    await waitFor(() => expect(result.current.trabajos[0]?.fase).toBe('listo'));
    expect(reconocer).toHaveBeenCalledWith(archivo, 'spa');
    expect(result.current.trabajos[0]?.resultado?.movimientos[0]?.confianza).toBe('media');
    expect(result.current.trabajos[0]?.resultado?.advertencias[0]).toMatch(/revisa cada movimiento/i);
  });
});
