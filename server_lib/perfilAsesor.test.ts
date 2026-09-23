import { describe, expect, it } from 'vitest';
import { construirPerfilFinancieroCompleto, huellaPerfilFinanciero } from './perfilAsesor';

const datos = {
  cajitas: [
    { id: 'cuenta-nequi', nombre: 'Nequi', tipo: 'cuenta', clase_cuenta: 'billetera', meta_cop: null },
    { id: 'tarjeta-1', nombre: 'Tarjeta principal', tipo: 'tarjeta', limite_credito_cop: 2_000_000, dia_pago: 15 },
  ],
  categorias: [{ id: 'p-mascota', nombre: 'Mascotas' }],
  transacciones: [
    { occurred_on: '2026-09-12', kind: 'gasto', amount_cop: 65_000, category: 'p-mascota', description: 'Veterinaria', cuenta_id: 'cuenta-nequi' },
    { occurred_on: '2026-08-30', kind: 'ingreso', amount_cop: 1_800_000, category: 'ingreso', description: 'Nómina', cuenta_id: 'cuenta-nequi' },
    { occurred_on: '2026-08-02', kind: 'gasto', amount_cop: 80_000, category: 'comida', description: 'Mercado', cuenta_id: 'cuenta-nequi' },
  ],
  movimientosCajitas: [
    { occurred_on: '2026-09-12', cajita_id: 'tarjeta-1', kind: 'compra', delta_cop: 65_000, categoria: 'p-mascota', nota: 'Consulta' },
  ],
  metas: [{ nombre: 'Viaje', objetivo_cop: 3_000_000, ahorrado_cop: 900_000, fecha_objetivo: '2027-01-15', cajita_id: 'cuenta-nequi' }],
  presupuestos: [{ categoria: 'comida', monto_cop: 400_000 }],
  recurrentes: [{ nombre: 'Internet', kind: 'gasto', amount_cop: 90_000, categoria: 'servicios', cuenta_id: 'cuenta-nequi', dia_del_mes: 10, archived_at: null }],
};

describe('perfil financiero para el Asesor', () => {
  it('combina el historial completo con detalle útil sin enviar transcripciones crudas', () => {
    const perfil = construirPerfilFinancieroCompleto(datos);

    expect(perfil.cobertura).toMatchObject({ transacciones: 3, cuentas: 2, metas: 1 });
    expect(perfil.panoramaHistorico).toMatchObject({ ingresosCop: 1_800_000, gastosCop: 145_000, balanceCop: 1_655_000 });
    expect(perfil.historialCompleto).toMatchObject({
      gastosPorCategoria: expect.arrayContaining([{ clave: 'Mascotas', montoCop: 65_000 }]),
      gastosPorCuenta: [{ clave: 'Nequi', montoCop: 145_000 }],
    });
    expect(perfil.actividadDetalladaReciente).toEqual(expect.arrayContaining([
      expect.objectContaining({ descripcion: 'Veterinaria', cuenta: 'Nequi', categoria: 'Mascotas' }),
    ]));
    expect(JSON.stringify(perfil)).not.toContain('raw_transcript');
  });

  it('cambia la huella cuando cambia cualquier dato que afecta el análisis', () => {
    const original = construirPerfilFinancieroCompleto(datos);
    const actualizado = construirPerfilFinancieroCompleto({
      ...datos,
      transacciones: [...datos.transacciones, {
        occurred_on: '2026-07-18', kind: 'gasto', amount_cop: 22_000, category: 'comida', description: 'Almuerzo', cuenta_id: 'cuenta-nequi',
      }],
    });

    expect(huellaPerfilFinanciero(original)).not.toBe(huellaPerfilFinanciero(actualizado));
  });
});
