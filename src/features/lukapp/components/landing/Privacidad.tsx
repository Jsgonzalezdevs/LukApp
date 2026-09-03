import React from 'react';
import { Braces, HardDrive, RefreshCw, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Reveal } from './primitivas';

const PUNTOS: { Icono: LucideIcon; titulo: string; texto: string }[] = [
  {
    Icono: HardDrive,
    titulo: 'Empieza sin cuenta',
    texto:
      'Tus movimientos se guardan en tu propio navegador. Puedes usar LukApp entera sin registrarte en nada.'
  },
  {
    Icono: RefreshCw,
    titulo: 'La nube es opcional',
    texto:
      'Si quieres los mismos datos en el celular y en el computador, creas una cuenta. Si no, no.'
  },
  {
    Icono: ShieldCheck,
    titulo: 'Nada se vende',
    texto:
      'No hay anunciantes, no hay perfiles de consumo, no hay terceros mirando en qué gastas.'
  },
  {
    Icono: Braces,
    titulo: 'La matemática se puede leer',
    texto:
      'El código está publicado. Si no confías en la cifra, puedes ir a ver de dónde salió.'
  }
];

export const Privacidad: React.FC = () => (
  <section className="privacidad" id="privacidad">
    <div className="privacidad-composicion">
      <Reveal as="header" className="privacidad-cabecera">
        <span className="seccion-etiqueta">Privacidad</span>
        <h2>Tu información es tuya.</h2>
        <p className="seccion-sub">
          Empieza sin cuenta. Si después quieres usar tus datos en otro equipo,
          tú decides si los llevas a la nube.
        </p>
      </Reveal>

      <ul className="privacidad-lista">
        {PUNTOS.map(({ Icono, titulo, texto }, i) => (
          <Reveal as="li" className="privacidad-item" key={titulo} delay={i * 0.05}>
            <span className="privacidad-icono">
              <Icono size={19} strokeWidth={1.6} aria-hidden />
            </span>
            <div>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </div>
  </section>
);
