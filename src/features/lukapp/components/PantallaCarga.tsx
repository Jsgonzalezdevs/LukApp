import React, { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { PANELES_AJUSTES, type PanelAjustes, type SectionId } from '../sections';

/** Por debajo de esto la carga se siente instantánea; un indicador solo parpadearía. */
const RETRASO_INDICADOR_MS = 350;
const LIMITE_CARGA_MS = 22_000;

/**
 * Espera neutra mientras llega una pantalla: el fondo de LukApp y, si tarda,
 * un indicador pequeño. Reemplaza los esqueletos, que en Android se veían
 * como bloques sueltos y anunciaban una forma que a veces no era la real.
 */
export const PantallaCarga: React.FC<{ etiqueta?: string }> = ({ etiqueta = 'LukApp' }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const temporizador = window.setTimeout(() => setVisible(true), RETRASO_INDICADOR_MS);
    return () => window.clearTimeout(temporizador);
  }, []);

  return (
    <div
      className="flex min-h-[100dvh] w-full items-center justify-center bg-[var(--fin-bg,#1a1817)] text-[var(--fin-ink-soft,#a9a3ad)]"
      role="status"
      aria-label={`Cargando ${etiqueta}`}
    >
      {visible ? <LoaderCircle className="h-7 w-7 animate-spin opacity-70" strokeWidth={2.25} aria-hidden="true" /> : null}
    </div>
  );
};

const etiquetaDe = (seccion: SectionId, panel: PanelAjustes | null): string => {
  if (panel) return PANELES_AJUSTES.find((item) => item.id === panel)?.label ?? 'esta pantalla';
  if (seccion === 'dinero') return 'Dinero';
  if (seccion === 'mes') return 'Mes';
  if (seccion === 'asesor') return 'Asesor';
  if (seccion === 'calendario') return 'Calendario';
  if (seccion === 'ajustes') return 'Más';
  return 'Inicio';
};

const MensajeReintento: React.FC<{ etiqueta: string }> = ({ etiqueta }) => (
  <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--fin-bg)] p-6 text-[var(--fin-ink)]">
    <section className="max-w-md text-center" role="alert">
      <h1 className="text-xl font-semibold">No terminó de abrir {etiqueta}</h1>
      <p className="mt-3 text-[var(--fin-ink-soft)]">La carga tardó más de lo esperado. Revisa tu conexión y vuelve a intentarlo; tus datos guardados no se han reemplazado.</p>
      <button type="button" className="mt-6 rounded-full bg-[var(--fin-accent)] px-6 py-3 font-semibold text-white" onClick={() => window.location.reload()}>
        Volver a cargar LukApp
      </button>
    </section>
  </main>
);

/** Evita que una espera de red o de un módulo deje la carga en pantalla para siempre. */
export const CargaSeccion: React.FC<{ seccion: SectionId; panel?: PanelAjustes | null }> = ({ seccion, panel = null }) => {
  const [vencida, setVencida] = useState(false);
  const etiqueta = etiquetaDe(seccion, panel);

  useEffect(() => {
    const temporizador = window.setTimeout(() => setVencida(true), LIMITE_CARGA_MS);
    return () => window.clearTimeout(temporizador);
  }, []);

  return vencida ? <MensajeReintento etiqueta={etiqueta} /> : <PantallaCarga etiqueta={etiqueta} />;
};

interface LimiteCargaProps {
  children: React.ReactNode;
  seccion: SectionId;
  panel?: PanelAjustes | null;
}

/** Recupera la navegación si falla la descarga de un componente diferido. */
export class LimiteErrorCarga extends React.Component<LimiteCargaProps, { fallo: boolean }> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error: Error) {
    console.error('No se pudo abrir la pantalla solicitada:', error);
  }

  render() {
    if (this.state.fallo) {
      return <MensajeReintento etiqueta={etiquetaDe(this.props.seccion, this.props.panel ?? null)} />;
    }
    return this.props.children;
  }
}
