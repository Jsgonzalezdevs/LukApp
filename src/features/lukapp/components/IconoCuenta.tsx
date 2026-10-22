import { createElement, type CSSProperties } from 'react';
import { Landmark, Smartphone, Wallet } from 'lucide-react';
import type { Cajita } from '../data/modelos';
import { claseDeCuenta } from '../data/modelos';
import { iconoDeCajita } from '../cajitaIconos';
import { entidadDeCuenta } from '../lib/entidadesFinancieras';
import './IconoCuenta.css';

interface IconoCuentaProps {
  cuenta: Pick<Cajita, 'nombre' | 'tipo' | 'claseCuenta' | 'icon'>;
  tamano?: number;
  className?: string;
  trazo?: number;
}

export const IconoCuenta = ({ cuenta, tamano = 20, className = '', trazo = 1.8 }: IconoCuentaProps) => {
  const entidad = entidadDeCuenta(cuenta);
  if (entidad) {
    return <span aria-hidden="true" data-logo-banco={entidad.nombre} className={`icono-entidad ${className}`} style={{
      width: tamano,
      height: tamano,
      maskImage: `url("${entidad.logo}")`,
      WebkitMaskImage: `url("${entidad.logo}")`,
      maskSize: entidad.encajeLogo ?? 'contain',
      WebkitMaskSize: entidad.encajeLogo ?? 'contain',
      maskPosition: entidad.posicionLogo ?? 'center',
      WebkitMaskPosition: entidad.posicionLogo ?? 'center',
      maskMode: entidad.luminanciaLogo ? 'luminance' : 'alpha',
    } as CSSProperties} />;
  }
  const clase = claseDeCuenta(cuenta);
  const Icono = cuenta.tipo === 'cuenta' && cuenta.icon === 'PiggyBank'
    ? clase === 'efectivo' ? Wallet : clase === 'billetera' ? Smartphone : Landmark
    : iconoDeCajita(cuenta.icon);
  return createElement(Icono, { width: tamano, height: tamano, className, strokeWidth: trazo, 'aria-hidden': true });
};
