import { describe, expect, it } from 'vitest';
import { fechaSerialExcel, filasUsuarios, generarXlsxUsuarios } from './exportarUsuarios';
import type { Perfil, RolPersonalizado } from './superadmin.types';

const perfil = (extra: Partial<Perfil>): Perfil => ({
  id: '1',
  email: 'ana@correo.co',
  usuario: 'ana',
  rol: 'usuario',
  rol_personalizado_id: null,
  created_at: '2026-01-01T05:00:00Z',
  ultimo_acceso_at: null,
  ...extra,
});

const roles: RolPersonalizado[] = [
  { id: 'r1', nombre: 'Soporte', descripcion: '', permisos: [], createdAt: '', createdByEmail: '' },
];

describe('exportar usuarios a Excel', () => {
  it('convierte la fecha a serial de Excel en hora de Colombia', () => {
    // 05:00 UTC es medianoche en Colombia: el serial debe ser un día exacto.
    expect(fechaSerialExcel('2026-01-01T05:00:00Z')).toBe(46023);
    expect(fechaSerialExcel('no es fecha')).toBeNull();
  });

  it('pone correo, nombre, rol y fechas por fila', () => {
    const filas = filasUsuarios(
      [perfil({}), perfil({ email: 'b@x.co', usuario: null, rol: 'admin' }), perfil({ rol_personalizado_id: 'r1' })],
      roles,
    );
    expect(filas[0][0]).toEqual({ tipo: 'texto', valor: 'ana@correo.co' });
    expect(filas[0][4]).toEqual({ tipo: 'vacia' });
    expect(filas[1][1]).toEqual({ tipo: 'texto', valor: '' });
    expect(filas[1][2]).toEqual({ tipo: 'texto', valor: 'Admin' });
    expect(filas[2][2]).toEqual({ tipo: 'texto', valor: 'Soporte' });
  });

  it('arma un zip válido con los correos escapados', () => {
    const bytes = generarXlsxUsuarios([perfil({ usuario: 'Tom & <Jerry>' })], roles);
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const texto = new TextDecoder().decode(bytes);
    expect(texto).toContain('ana@correo.co');
    expect(texto).toContain('Tom &amp; &lt;Jerry&gt;');
    expect(texto).toContain('xl/worksheets/sheet1.xml');
  });
});
