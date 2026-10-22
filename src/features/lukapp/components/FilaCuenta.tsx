import { Star } from 'lucide-react';
import type { Cajita } from '../data/modelos';
import { etiquetaTipoCajita } from '../data/modelos';
import { entidadDeCuenta, estiloEntidad, nombreVisibleCuenta } from '../lib/entidadesFinancieras';
import { formatCop } from '../lib/formatCop';
import './FilaCuenta.css';
import { IconoCuenta } from './IconoCuenta';

interface FilaCuentaProps {
  cuenta: Cajita;
  saldo: number;
  privacidad: boolean;
  principal: boolean;
  onAbrir: (cuenta: Cajita) => void;
}

export const FilaCuenta = ({ cuenta, saldo, privacidad, principal, onAbrir }: FilaCuentaProps) => {
  const entidad = entidadDeCuenta(cuenta);

  return (
    <button type="button" onClick={() => onAbrir(cuenta)} className="cuenta-fila">
      <span className="cuenta-identidad" style={entidad ? estiloEntidad(entidad) : undefined}>
        <span className="cuenta-icono" aria-hidden="true"><IconoCuenta cuenta={cuenta} tamano={22} /></span>
        <span className="cuenta-etiquetas">
          <span className="cuenta-nombre">{nombreVisibleCuenta(cuenta)}</span>
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
