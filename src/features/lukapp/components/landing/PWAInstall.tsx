import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Download, Smartphone, Phone } from 'lucide-react';

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
    <section className="pwa-install" aria-label="Instalar LukApp">
      <motion.div
        className="pwa-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.section
        className="pwa-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-titulo"
        aria-describedby="pwa-descripcion"
        initial={{ opacity: 0, y: 32, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="pwa-asa" aria-hidden="true" />

        <header className="pwa-cabecera">
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
          <div className="pwa-titulos">
            <span>Instala LukApp</span>
            <h2 id="pwa-titulo">Mejor en app</h2>
          </div>
          <button
            type="button"
            className="pwa-cerrar"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </header>

        <p className="pwa-descripcion" id="pwa-descripcion">
          Te acompaño paso a paso. Toma menos de un minuto.
        </p>

        <div className="pwa-progreso" aria-label={`Paso ${paso + 1} de ${pasos.length}`}>
          <span className="pwa-progreso-texto">Paso {paso + 1} de {pasos.length}</span>
          <div className="pwa-progreso-barras" aria-hidden="true">
            {pasos.map((_, indice) => (
              <span
                key={indice}
                className={`${indice <= paso ? 'completo' : ''} ${indice === paso ? 'activo' : ''}`}
              />
            ))}
          </div>
        </div>

        <motion.div
          className="pwa-paso pwa-paso-activo"
          key={`${platform}-${paso}`}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <div className="pwa-numero">{paso + 1}</div>
          <div className="pwa-contenido"><h3>{titulo}</h3><p>{instruccion}</p><small>{detalle}</small></div>
        </motion.div>

        <div className="pwa-beneficios" aria-label="Ventajas de instalar LukApp">
          <div className="pwa-beneficio">
            <Phone size={18} />
            <span>Acceso rápido</span>
          </div>
          <div className="pwa-beneficio">
            <Smartphone size={18} />
            <span>Funciona offline</span>
          </div>
          <div className="pwa-beneficio">
            <Download size={18} />
            <span>Sin tienda</span>
          </div>
        </div>

        <div className="pwa-acciones">
          <button
            type="button"
            className="pwa-boton pwa-continuar"
            onClick={() => paso < pasos.length - 1 ? setPaso(paso + 1) : onProceed?.()}
          >
            {paso < pasos.length - 1 ? 'Siguiente' : 'Listo, continuar'}
          </button>
          <button type="button" className="pwa-boton pwa-despues" onClick={onSkip}>
            Hacerlo después
          </button>
        </div>
      </motion.section>
    </section>
  );
};
