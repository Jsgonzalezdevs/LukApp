import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  obtenerEstadoPermiso,
  verificarRecordatorioRacha,
} from './recordatorioRacha';

describe('recordatorioRacha', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('detecta estado de permisos', () => {
    const estado = obtenerEstadoPermiso();
    expect(typeof estado).toBe('string');
  });

  it('no envia si activo es false', async () => {
    const res = await verificarRecordatorioRacha(false, '20:30', false, 5, '2026-08-24');
    expect(res).toBe(false);
  });

  it('no envia si ya anoto hoy', async () => {
    const res = await verificarRecordatorioRacha(true, '20:30', true, 5, '2026-08-24');
    expect(res).toBe(false);
  });

  it('no envia si no tiene permisos concedidos', async () => {
    const res = await verificarRecordatorioRacha(true, '20:30', false, 5, '2026-08-24');
    // En Node / test env sin granted
    expect(res).toBe(false);
  });
});
