import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Share, X } from 'lucide-react';
import { solicitarInstalacionPwa, useInstalacionPwa } from '../../data/instalacionPwa';
import './PWAInstall.css';

interface PWAInstallProps {
  onClose: () => void;
}

export const PWAInstall: React.FC<PWAInstallProps> = ({ onClose }) => {
  const { opcion, instalada } = useInstalacionPwa();
  const [ocupado, setOcupado] = useState(false);

  if (instalada || !opcion) return null;

  const esIos = opcion === 'ios';
  const instalar = async () => {
    setOcupado(true);
    const resultado = await solicitarInstalacionPwa();
    setOcupado(false);
    if (resultado !== 'indisponible') onClose();
  };

  return (
    <motion.aside
      className="pwa-invitacion"
      aria-label="Instalar LukApp"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <div className="pwa-invitacion-cabecera">
        <img className="pwa-invitacion-icono" src="/lukapp-icon-192.png" width="42" height="42" alt="" aria-hidden />
        <div className="pwa-invitacion-texto">
          <h2>{esIos ? 'Ten LukApp a un toque' : 'Instala LukApp'}</h2>
          <p>{esIos
            ? 'Quedará junto a tus demás aplicaciones.'
            : 'Confirma una vez y quedará lista en tu dispositivo.'}</p>
        </div>
        <button type="button" className="pwa-invitacion-cerrar" onClick={onClose} aria-label="Ahora no">
          <X size={18} aria-hidden />
        </button>
      </div>

      {esIos ? (
        <p className="pwa-invitacion-ios">
          <Share size={15} aria-hidden /> <strong>En tu navegador:</strong> toca Compartir y elige “Agregar a pantalla de inicio”.
          Al abrirla por primera vez, puede pedirte entrar de nuevo.
        </p>
      ) : (
        <button
          type="button"
          className="pwa-invitacion-accion"
          onClick={() => void instalar()}
          disabled={ocupado}
        >
          <Download size={18} aria-hidden />
          {ocupado ? 'Abriendo instalación…' : 'Instalar LukApp'}
        </button>
      )}
    </motion.aside>
  );
};
