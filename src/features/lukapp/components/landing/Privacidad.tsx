import React from 'react';
import { Braces, HardDrive, RefreshCw, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Reveal } from './primitivas';
import { TituloPalabras } from './adornos';

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
        <span className="seccion-etiqueta">Tus datos, tus reglas</span>
        <TituloPalabras texto="Tu plata no es el producto" resaltarUltimas={2} />
        <p className="seccion-sub">
          Empieza sin entregar información personal. La nube aparece solo si tú
          decides que la necesitas.
        </p>
        <span className="privacidad-promesa">Sin anuncios. Sin letra pequeña.</span>
      </Reveal>

      <div className="privacidad-lista">
        {PUNTOS.map(({ Icono, titulo, texto }, i) => (
          <Reveal as="article" className="privacidad-item" key={titulo} delay={i * 0.06}>
            <span className="privacidad-indice" aria-hidden="true">0{i + 1}</span>
            <span className="privacidad-icono">
              <Icono size={19} strokeWidth={1.6} aria-hidden />
            </span>
            <div>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);
