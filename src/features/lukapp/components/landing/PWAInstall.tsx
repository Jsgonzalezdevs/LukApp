import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Download, Smartphone, Phone } from 'lucide-react';
import { Reveal } from './primitivas';

type Platform = 'ios' | 'android' | 'desktop' | null;

const detectPlatform = (): Platform => {
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);

  if (isIos) return 'ios';
  if (isAndroid) return 'android';

  return 'desktop';
};

interface PWAInstallProps {
  onClose?: () => void;
  onSkip?: () => void;
  onProceed?: () => void;
}

export const PWAInstall: React.FC<PWAInstallProps> = ({ onClose, onSkip, onProceed }) => {
  const [platform, setPlatform] = useState<Platform>(null);
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  if (!platform) return null;

  const isIos = platform === 'ios';
  const pasos = isIos
    ? [
        ['Abre Compartir', 'Toca el botón de compartir en Safari.', 'Es el cuadrado con una flecha hacia arriba.'],
        ['Añade LukApp', 'Elige “Agregar a pantalla de inicio”.', 'Si no lo ves, desliza el menú hacia arriba.'],
        ['Confirma', 'Toca “Agregar” y busca el ícono de LukApp.', 'Desde ahí podrás abrirla como una app.'],
      ]
    : platform === 'android'
      ? [
          ['Abre el menú', 'Toca los tres puntos de Chrome.', 'Están arriba a la derecha.'],
          ['Instala LukApp', 'Toca “Instalar aplicación”.', 'Luego confirma la instalación.'],
          ['Ya está lista', 'Busca LukApp entre tus aplicaciones.', 'Ábrela desde su nuevo ícono.'],
        ]
      : [
          ['Busca instalar', 'Mira el ícono de instalación en la barra de dirección.', 'También puede estar dentro del menú del navegador.'],
          ['Instala LukApp', 'Elige “Instalar LukApp”.', 'Confirma cuando el navegador lo pregunte.'],
          ['Ábrela cuando quieras', 'LukApp quedará en tu escritorio.', 'Tendrás acceso directo a tus finanzas.'],
        ];
  const [titulo, instruccion, detalle] = pasos[paso];

  return (
    <section className="pwa-install">
      <motion.div
        className="pwa-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <Reveal className="pwa-modal">
        <div className="pwa-cabecera">
          {/* El mismo icono que va a quedar en la pantalla de inicio: enseñarlo
              aquí es la mitad de la instrucción. */}
          <img
            className="pwa-icono"
            src="/lukapp-icon-192.png"
            width="192"
            height="192"
            alt=""
            aria-hidden
          />
          <h2>Mejor en app</h2>
          <button
            className="pwa-cerrar"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <p className="pwa-descripcion">Te acompaño en menos de un minuto. Solo sigue este paso:</p>

        <div className="pwa-progreso" aria-label={`Paso ${paso + 1} de ${pasos.length}`}>
          {pasos.map((_, indice) => <span key={indice} className={indice === paso ? 'activo' : ''} />)}
        </div>

        <div className="pwa-paso pwa-paso-activo">
          <div className="pwa-numero">{paso + 1}</div>
          <div className="pwa-contenido"><h3>{titulo}</h3><p>{instruccion}</p><small>{detalle}</small></div>
        </div>

        <div className="pwa-beneficios">
          <div className="pwa-beneficio">
            <Phone size={18} />
            <span>Acceso instantáneo desde tu pantalla de inicio</span>
          </div>
          <div className="pwa-beneficio">
            <Smartphone size={18} />
            <span>Funciona sin conexión (datos en caché)</span>
          </div>
          <div className="pwa-beneficio">
            <Download size={18} />
            <span>Sin necesidad de ir a tiendas de apps</span>
          </div>
        </div>

        <div className="pwa-acciones">
          <button className="btn-primary-lg pwa-continuar" onClick={() => paso < pasos.length - 1 ? setPaso(paso + 1) : onProceed?.()}>
            {paso < pasos.length - 1 ? 'Siguiente' : 'Listo, continuar'}
          </button>
          <button className="btn-secondary pwa-despues" onClick={onSkip}>
            Hacerlo después
          </button>
        </div>
      </Reveal>
    </section>
  );
};
