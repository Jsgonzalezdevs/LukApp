import React from 'react';
import { Check, X } from 'lucide-react';
import {
  coincideConIdentificador,
  evaluarRequisitosContrasena,
} from '../../../lib/seguridad';
import './ChecklistContrasena.css';

interface ChecklistContrasenaProps {
  contrasena: string;
  /** Usuario y correo: la clave no puede ser igual a ninguno. */
  identificadores?: Array<string | null | undefined>;
  id?: string;
}

/**
 * Los requisitos de la contraseña como lista que se va marcando mientras se
 * escribe. Ver de una vez qué falta evita el "intenta otra vez" a ciegas.
 */
export const ChecklistContrasena: React.FC<ChecklistContrasenaProps> = ({
  contrasena,
  identificadores = [],
  id,
}) => {
  const requisitos = evaluarRequisitosContrasena(contrasena);
  const cumplidos = requisitos.filter((r) => r.cumple).length;
  const todos = cumplidos === requisitos.length;
  const repiteIdentificador =
    todos && coincideConIdentificador(contrasena, identificadores);

  return (
    <div className="checklist-clave" id={id}>
      <div
        className="checklist-clave-barra"
        role="progressbar"
        aria-label="Requisitos de la contraseña cumplidos"
        aria-valuemin={0}
        aria-valuemax={requisitos.length}
        aria-valuenow={cumplidos}
      >
        <span
          className={todos ? 'lleno' : undefined}
          style={{ width: `${(cumplidos / requisitos.length) * 100}%` }}
        />
      </div>
      <ul aria-live="polite">
        {requisitos.map((requisito) => (
          <li key={requisito.id} className={requisito.cumple ? 'cumple' : undefined}>
            <span className="checklist-clave-icono" aria-hidden>
              {requisito.cumple ? (
                <Check size={12} strokeWidth={3.25} />
              ) : (
                <X size={12} strokeWidth={3.25} />
              )}
            </span>
            {requisito.texto}
            <span className="sr-only">{requisito.cumple ? ' (listo)' : ' (falta)'}</span>
          </li>
        ))}
      </ul>
      {repiteIdentificador && (
        <p className="checklist-clave-aviso" role="alert">
          No puede ser igual a tu usuario ni a tu correo.
        </p>
      )}
    </div>
  );
};
