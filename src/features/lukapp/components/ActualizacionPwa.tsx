import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/** Ofrece una actualización solo cuando ya está descargada y lista para aplicar. */
export const ActualizacionPwa = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const revisar = async () => {
      const registro = await navigator.serviceWorker?.getRegistration();
      setVisible(Boolean(registro?.waiting));
    };
    const alActualizar = () => void revisar();
    window.addEventListener('lukapp:actualizacion-pwa', alActualizar);
    void revisar();
    return () => window.removeEventListener('lukapp:actualizacion-pwa', alActualizar);
  }, []);

  if (!visible) return null;
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3" role="status">
      <Download className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-accent)]" strokeWidth={2.5} />
      <p className="flex-1 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
        Hay una mejora lista. Actualiza cuando termines lo que estás haciendo.
      </p>
      <button type="button" className="text-[13px] font-semibold text-[var(--fin-accent)]" onClick={async () => {
        const registro = await navigator.serviceWorker?.getRegistration();
        registro?.waiting?.postMessage({ tipo: 'activar-actualizacion' });
        navigator.serviceWorker?.addEventListener('controllerchange', () => window.location.reload(), { once: true });
      }}>Actualizar</button>
      <button type="button" aria-label="Cerrar aviso de actualización" onClick={() => setVisible(false)}><X className="h-4 w-4 text-[var(--fin-ink-faint)]" /></button>
    </div>
  );
};
