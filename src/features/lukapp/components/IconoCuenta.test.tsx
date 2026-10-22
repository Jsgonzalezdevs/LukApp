import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Cajita } from '../data/modelos';
import { ENTIDADES_FINANCIERAS } from '../lib/entidadesFinancieras';
import { IconoCuenta } from './IconoCuenta';

const cuenta = (nombre: string, cambios = {}): Cajita => ({
  id: nombre, nombre, tipo: 'cuenta', icon: 'PiggyBank', metaCop: null, tasaEaPct: null,
  createdAt: '2026-10-21', archivedAt: null, ...cambios,
});

describe('logos de las cuentas', () => {
  it.each([
    ['Nubnak', 'Nu'], ['Ne qui', 'Nequi'], ['Ban col ombia', 'Bancolombia'],
    ['Davi vie nda', 'Davivienda'], ['Rap pi', 'Rappi'], ['Davi palta', 'DaviPlata'],
  ])('muestra el símbolo de %s aunque el nombre tenga errores o espacios', (nombre, marca) => {
    const { container } = render(<IconoCuenta cuenta={cuenta(nombre, { icon: 'Wallet' })} tamano={22} />);
    const logo = container.querySelector('[data-logo-banco]');
    expect(logo).toHaveAttribute('data-logo-banco', marca);
    expect(logo).toHaveAttribute('aria-hidden', 'true');
    expect(logo).toHaveStyle({ width: '22px', height: '22px' });
    expect(container.querySelector('svg')).toBeNull();
  });

  it('conserva iconos genéricos para efectivo, entidades desconocidas y ahorros', () => {
    for (const datos of [cuenta('Efectivo'), cuenta('Mi banco'), cuenta('Nu', { tipo: 'cajita' }), cuenta('Nequi', { claseCuenta: 'efectivo' })]) {
      const { container, unmount } = render(<IconoCuenta cuenta={datos} />);
      expect(container.querySelector('[data-logo-banco]')).toBeNull();
      expect(container.querySelector('svg')).not.toBeNull();
      unmount();
    }
  });

  it('no asigna un logo cuando el nombre es ambiguo', () => {
    const { container } = render(<IconoCuenta cuenta={cuenta('Nu y Neqiu')} />);
    expect(container.querySelector('[data-logo-banco]')).toBeNull();
  });

  it('incluye todos los archivos locales y evita contenido ejecutable en los SVG', () => {
    for (const entidad of ENTIDADES_FINANCIERAS) {
      expect(entidad.logo).toMatch(/^\/bancos\/[a-z0-9]+\.(svg|png)$/);
      const archivo = resolve(process.cwd(), 'public', entidad.logo.slice(1));
      expect(existsSync(archivo), entidad.nombre).toBe(true);
      const contenido = readFileSync(archivo);
      expect(contenido.byteLength).toBeGreaterThan(100);
      if (archivo.endsWith('.svg')) {
        expect(contenido.toString()).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(contenido.toString()).toContain('viewBox=');
        expect(contenido.toString()).not.toMatch(/(?:href|src)="(?:https?:|javascript:)/i);
        expect(contenido.toString()).not.toMatch(/<(?:script|foreignObject)\b|\bon\w+\s*=/i);
      }
    }
  });
});
