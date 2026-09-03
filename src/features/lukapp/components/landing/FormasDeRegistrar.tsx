import React from 'react';
import {
  Camera,
  FileText,
  Keyboard,
  Mic,
  Repeat,
  Smartphone,
  Sparkles,
  type LucideIcon
} from 'lucide-react';
import { Reveal } from './primitivas';

const FORMAS: {
  Icono: LucideIcon;
  titulo: string;
  texto: string;
  ejemplo: string;
}[] = [
  {
    Icono: Smartphone,
    titulo: 'Con Apple Pay',
    texto: 'Cada pago con tu iPhone se anota solo con Atajos sin abrir la app.',
    ejemplo: 'Wallet → automático'
  },
  {
    Icono: Mic,
    titulo: 'Hablando',
    texto: 'Mantén el botón y cuenta el gasto en voz alta. Se transcribe y se registra.',
    ejemplo: '«cuarenta mil en el almuerzo»'
  },
  {
    Icono: Keyboard,
    titulo: 'Escribiendo',
    texto: 'Una línea corta, como si le mandaras un mensaje a alguien. Sin formularios.',
    ejemplo: 'rappi 28 mil'
  },
  {
    Icono: Camera,
    titulo: 'Con una foto',
    texto: 'Tómale foto al recibo. Lee el monto y la fecha del papel.',
    ejemplo: 'Recibo → gasto'
  },
  {
    Icono: FileText,
    titulo: 'Del extracto del banco',
    texto: 'Sube el PDF de cualquier banco colombiano: la IA identifica cada movimiento, comercio, categoría y referencia para que lo revises antes de importar.',
    ejemplo: 'PDF → 84 movimientos'
  },
  {
    Icono: Repeat,
    titulo: 'Solo, cada mes',
    texto: 'Lo que se repite se declara una vez y aparece en su fecha.',
    ejemplo: 'Arriendo, el 1'
  },
  {
    Icono: Sparkles,
    titulo: 'A mano, si prefieres',
    texto: 'Teclado numérico, categoría y listo. Sin adivinanzas de por medio.',
    ejemplo: 'Control total'
  }
];

export const FormasDeRegistrar: React.FC = () => (
  <section className="formas" id="formas">
    <div className="formas-composicion">
      <Reveal as="header" className="formas-cabecera">
        <span className="seccion-etiqueta">Siete maneras, cero formularios</span>
        <h2>
          Registra a tu manera.
          <span className="formas-titulo-acento"> La app se adapta.</span>
        </h2>
        <p className="seccion-sub">
          Habla, escribe, toma una foto o deja que ocurra solo. Cambia de método
          cuando quieras sin cambiar cómo llevas tus cuentas.
        </p>
        <span className="formas-conteo" aria-hidden="true">
          <strong>07</strong>
          <span>caminos al mismo registro</span>
        </span>
      </Reveal>

      <div className="formas-repertorio">
        {FORMAS.filter(({ titulo }) => titulo === 'Hablando').map(({ Icono, titulo, texto, ejemplo }) => (
          <Reveal as="article" className="forma-principal" key={titulo}>
            <div className="forma-principal-cabecera">
              <span className="forma-principal-icono">
                <Icono size={22} strokeWidth={1.6} aria-hidden />
              </span>
              <span>La forma más natural</span>
            </div>
            <div className="forma-principal-cuerpo">
              <div>
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </div>
              <span className="forma-principal-ejemplo">{ejemplo}</span>
            </div>
          </Reveal>
        ))}

        <div className="formas-lista">
          {FORMAS.filter(({ titulo }) => titulo !== 'Hablando').map(({ Icono, titulo, texto, ejemplo }, i) => (
            <Reveal as="article" className="forma-alternativa" key={titulo} delay={i * 0.05}>
              <span className="forma-numero" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <span className="forma-icono">
                <Icono size={18} strokeWidth={1.6} aria-hidden />
              </span>
              <div className="forma-contenido">
                <div className="forma-titulo-fila">
                  <h3>{titulo}</h3>
                  <span className="forma-ejemplo">{ejemplo}</span>
                </div>
                <p>{texto}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  </section>
);
