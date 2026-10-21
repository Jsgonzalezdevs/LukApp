import { Landmark, Smartphone, Star, Wallet } from 'lucide-react';
import { createElement } from 'react';
import type { Cajita } from '../data/modelos';
import { etiquetaTipoCajita } from '../data/modelos';
import { iconoDeCajita } from '../cajitaIconos';
import { entidadDeCuenta, estiloEntidad } from '../lib/entidadesFinancieras';
import { formatCop } from '../lib/formatCop';
import './FilaCuenta.css';

interface FilaCuentaProps {
  cuenta: Cajita;
  saldo: number;
  privacidad: boolean;
  principal: boolean;
  onAbrir: (cuenta: Cajita) => void;
}

export const FilaCuenta = ({ cuenta, saldo, privacidad, principal, onAbrir }: FilaCuentaProps) => {
  const entidad = entidadDeCuenta(cuenta);
  const clase = cuenta.claseCuenta ?? entidad?.claseCuenta;
  const Icono = cuenta.icon === 'PiggyBank'
    ? clase === 'efectivo' ? Wallet : clase === 'billetera' ? Smartphone : Landmark
    : iconoDeCajita(cuenta.icon);

  return (
    <button type="button" onClick={() => onAbrir(cuenta)} className="cuenta-fila">
      <span className="cuenta-identidad" style={entidad ? estiloEntidad(entidad) : undefined}>
        <span className="cuenta-icono" aria-hidden="true">{createElement(Icono, { size: 19, strokeWidth: 1.8 })}</span>
        <span className="cuenta-etiquetas">
          <span className="cuenta-nombre">{cuenta.nombre}</span>
          <span className="cuenta-tipo">{etiquetaTipoCajita(cuenta)}</span>
        </span>
      </span>
      <span className="cuenta-cifras">
        <span className="cuenta-saldo">{privacidad ? '$ ••••••' : formatCop(saldo)}</span>
        {principal ? <span className="cuenta-principal"><Star size={12} aria-hidden="true" /> Principal</span> : null}
      </span>
    </button>
  );
};
