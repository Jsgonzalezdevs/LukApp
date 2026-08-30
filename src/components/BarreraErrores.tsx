import { Component, type ErrorInfo, type ReactNode } from 'react';

interface BarreraErroresProps {
  children: ReactNode;
  /** Inyectable para comprobar la recuperación sin recargar la ventana de pruebas. */
  onReintentar?: () => void;
}

interface BarreraErroresState {
  huboError: boolean;
}

/**
 * Última red de seguridad de la aplicación.
 *
 * Un error de render no debe convertirse en una pantalla PWA vacía. No borra
 * caché ni datos: recargar vuelve a montar la app y `useAlmacen` recupera la
 * última copia persistida.
 */
export class BarreraErrores extends Component<BarreraErroresProps, BarreraErroresState> {
  state: BarreraErroresState = { huboError: false };

  static getDerivedStateFromError(): BarreraErroresState {
    return { huboError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // El límite evita una pantalla en blanco. El monitoreo remoto, si se
    // configura, debe vivir aquí sin exponer detalles técnicos a la persona.
  }

  private reintentar = () => {
    if (this.props.onReintentar) {
      this.props.onReintentar();
      return;
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.huboError) return this.props.children;

    return (
      <main className="flex min-h-dvh items-center justify-center bg-[var(--fin-bg)] px-5 text-center">
        <section className="w-full max-w-sm rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-6 shadow-sm">
          <p className="text-[13px] font-semibold text-[var(--fin-ink-faint)]">LukApp necesita reiniciarse</p>
          <h1 className="mt-2 text-[24px] font-semibold text-[var(--fin-ink)]">
            Algo no salió como esperábamos
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--fin-ink-soft)]">
            Tus datos guardados siguen intactos. Vuelve a abrir la app para continuar.
          </p>
          <button
            type="button"
            onClick={this.reintentar}
            className="mt-6 w-full rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] px-5 py-3 text-[17px] font-semibold text-[var(--fin-on-accent)]"
          >
            Volver a abrir
          </button>
        </section>
      </main>
    );
  }
}
