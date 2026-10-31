import React, { useEffect, useState } from 'react';
import { PANELES_AJUSTES, type PanelAjustes, type SectionId } from '../sections';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/** Un bloque con brillo que conserva la forma del contenido que va a llegar. */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', style }) => (
  <span
    className={`fin-skeleton block rounded-[var(--fin-r-control)] ${className}`}
    style={style}
    aria-hidden="true"
  />
);

const Contenedor: React.FC<{ children: React.ReactNode; pantalla: string; etiqueta: string }> = ({ children, pantalla, etiqueta }) => {
  useEffect(() => {
    document.documentElement.setAttribute('data-lukapp-esqueleto', pantalla);
    return () => {
      if (document.documentElement.getAttribute('data-lukapp-esqueleto') === pantalla) {
        document.documentElement.removeAttribute('data-lukapp-esqueleto');
      }
    };
  }, [pantalla]);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col gap-5 bg-[var(--fin-bg)] px-5 pb-28 pt-[calc(env(safe-area-inset-top)+1.5rem)] text-[var(--fin-ink)]" role="status" aria-label={`Cargando ${etiqueta}`}>
      {children}
    </main>
  );
};

const Titulo: React.FC<{ ancho?: string }> = ({ ancho = 'w-36' }) => (
  <div className="flex flex-col gap-2"><Skeleton className={`h-7 ${ancho}`} /><Skeleton className="h-3 w-24" /></div>
);

const Fila: React.FC<{ detalle?: boolean }> = ({ detalle = true }) => (
  <div className="flex items-center gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
    <Skeleton className="h-11 w-11 shrink-0 rounded-[var(--fin-r-pill)]" />
    <div className="flex min-w-0 flex-1 flex-col gap-2"><Skeleton className="h-[15px] w-2/5" />{detalle ? <Skeleton className="h-[13px] w-1/4" /> : null}</div>
    <Skeleton className="h-[17px] w-16 shrink-0" />
  </div>
);

export const SkeletonInicio: React.FC = () => (
  <Contenedor pantalla="inicio" etiqueta="Inicio">
    <div className="flex flex-col items-center gap-3"><Skeleton className="h-[15px] w-28" /><Skeleton className="h-[44px] w-48" /></div>
    <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Fila key={i} />)}</div>
  </Contenedor>
);

const SkeletonDinero: React.FC = () => (
  <>
    <div className="flex items-center justify-between"><Titulo ancho="w-28" /><Skeleton className="h-10 w-28 rounded-full" /></div>
    <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5"><Skeleton className="h-3 w-32" /><Skeleton className="mt-4 h-10 w-48" /><Skeleton className="mt-3 h-3 w-56 max-w-full" /></section>
    <div className="grid grid-cols-2 gap-3">{[0, 1].map((i) => <div key={i} className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4"><Skeleton className="h-3 w-20" /><Skeleton className="mt-3 h-5 w-28 max-w-full" /></div>)}</div>
    <Titulo ancho="w-32" />
    {[0, 1, 2].map((i) => <Fila key={i} />)}
  </>
);

const SkeletonMes: React.FC = () => (
  <>
    <div className="flex items-center justify-between"><Titulo ancho="w-20" /><Skeleton className="h-10 w-32 rounded-full" /></div>
    <div className="grid grid-cols-2 gap-3">{[0, 1].map((i) => <div key={i} className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4"><Skeleton className="h-3 w-20" /><Skeleton className="mt-3 h-6 w-28 max-w-full" /></div>)}</div>
    <section className="flex h-48 items-end gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] px-5 pb-5 pt-8">{[45, 72, 55, 88, 63, 76, 48].map((alto, i) => <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${alto}%` }} />)}</section>
    <Titulo ancho="w-40" />
    {[0, 1, 2].map((i) => <Fila key={i} />)}
  </>
);

const SkeletonAsesor: React.FC = () => (
  <>
    <div className="flex items-center gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4"><Skeleton className="h-12 w-12 rounded-full" /><div className="flex flex-col gap-2"><Skeleton className="h-5 w-28" /><Skeleton className="h-3 w-36" /></div></div>
    <div className="mt-4 flex flex-1 flex-col gap-4">
      <div className="max-w-[85%] rounded-3xl rounded-tl-md bg-[var(--fin-card)] p-4"><Skeleton className="h-3 w-40 max-w-full" /><Skeleton className="mt-2 h-3 w-52 max-w-full" /><Skeleton className="mt-2 h-3 w-32" /></div>
      <div className="ml-auto w-[75%] rounded-3xl rounded-tr-md bg-[var(--fin-card)] p-4"><Skeleton className="h-3 w-full" /><Skeleton className="mt-2 h-3 w-4/5" /></div>
      <div className="mt-auto flex flex-wrap gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-28 rounded-full" />)}</div>
      <Skeleton className="h-14 w-full rounded-full" />
    </div>
  </>
);

const SkeletonAjustes: React.FC<{ panel?: PanelAjustes | null }> = ({ panel }) => (
  <>
    <Titulo ancho={panel ? 'w-48' : 'w-28'} />
    {panel ? <div className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5"><Skeleton className="h-4 w-3/4" /><Skeleton className="mt-3 h-3 w-full" /></div> : <div className="flex items-center gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4"><Skeleton className="h-14 w-14 rounded-full" /><div className="flex flex-col gap-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-48" /></div></div>}
    {[0, 1, 2, 3, 4, 5].map((i) => <Fila key={i} detalle={!panel} />)}
  </>
);

const SkeletonCalendario: React.FC = () => (
  <>
    <div className="flex items-center justify-between"><Titulo ancho="w-40" /><Skeleton className="h-10 w-28 rounded-full" /></div>
    <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
      <div className="mb-4 grid grid-cols-7 gap-2">{[0, 1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="mx-auto h-3 w-5" />)}</div>
      <div className="grid grid-cols-7 gap-2">{Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="mx-auto h-8 w-8 rounded-full" />)}</div>
    </section>
    <Titulo ancho="w-36" />
    {[0, 1, 2].map((i) => <Fila key={i} />)}
  </>
);

const SkeletonPanel: React.FC<{ panel: PanelAjustes }> = ({ panel }) => {
  const etiqueta = PANELES_AJUSTES.find((item) => item.id === panel)?.label ?? 'esta herramienta';
  const campos = (cantidad = 2) => Array.from({ length: cantidad }, (_, i) => (
    <div key={i} className="flex flex-col gap-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-12 w-full rounded-2xl" /></div>
  ));
  const lista = (cantidad = 3, detalle = true) => Array.from({ length: cantidad }, (_, i) => <Fila key={i} detalle={detalle} />);
  const tarjetas = (cantidad: number, tipo: 'progreso' | 'opcion' | 'idea' = 'opcion') => Array.from({ length: cantidad }, (_, i) => (
    <section key={i} className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
      <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-2xl" /><Skeleton className="h-4 w-2/3" /></div>
      {tipo === 'progreso' ? <><Skeleton className="mt-4 h-3 w-1/3" /><Skeleton className="mt-3 h-2 w-full rounded-full" /><Skeleton className="mt-3 h-3 w-1/2" /></> : null}
      {tipo === 'idea' ? <><Skeleton className="mt-3 h-3 w-full" /><Skeleton className="mt-2 h-3 w-4/5" /><Skeleton className="mt-4 h-9 w-24 rounded-full" /></> : null}
      {tipo === 'opcion' ? <Skeleton className="mt-3 h-3 w-1/2" /> : null}
    </section>
  ));
  let contenido: React.ReactNode;

  if (panel === 'forecast') {
    contenido = <><div className="grid grid-cols-2 gap-3"><div className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-7 w-28" /></div><div className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4"><Skeleton className="h-3 w-20" /><Skeleton className="mt-3 h-7 w-24" /></div></div><section className="flex h-44 items-end gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">{[42, 66, 53, 82, 61, 92].map((alto, i) => <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${alto}%` }} />)}</section>{lista(2)}</>;
  } else if (panel === 'categorias') {
    contenido = <><Skeleton className="h-12 w-full rounded-full" /><div className="grid grid-cols-2 gap-3">{tarjetas(6)}</div></>;
  } else if (panel === 'topes') {
    contenido = <><div className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5"><Skeleton className="h-3 w-28" /><Skeleton className="mt-3 h-7 w-36" /><Skeleton className="mt-4 h-2 w-full rounded-full" /></div>{tarjetas(4, 'progreso')}</>;
  } else if (panel === 'periodo') {
    contenido = <><section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5"><Skeleton className="h-4 w-3/4" /><div className="mt-5 grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-2xl" />)}</div><Skeleton className="mt-5 h-3 w-full" /></section><Skeleton className="h-12 w-full rounded-full" /></>;
  } else if (panel === 'metas') {
    contenido = <><Skeleton className="h-12 w-full rounded-full" />{tarjetas(3, 'progreso')}</>;
  } else if (panel === 'recurrentes') {
    contenido = <><div className="grid grid-cols-7 gap-2 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">{Array.from({ length: 28 }, (_, i) => <Skeleton key={i} className="mx-auto h-7 w-7 rounded-full" />)}</div><Skeleton className="h-12 w-full rounded-full" />{lista(3)}</>;
  } else if (panel === 'compartido') {
    contenido = <><Skeleton className="h-12 w-full rounded-full" />{tarjetas(3, 'opcion')}</>;
  } else if (panel === 'dividir-cuenta') {
    contenido = <><section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5"><div className="grid grid-cols-2 gap-3">{campos(2)}</div><Skeleton className="mt-5 h-12 w-full rounded-full" /></section><section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5"><Skeleton className="h-3 w-28" /><Skeleton className="mt-3 h-8 w-36" />{campos(1)}</section></>;
  } else if (panel === 'vaquitas') {
    contenido = <><div className="flex items-center justify-between"><Skeleton className="h-5 w-32" /><Skeleton className="h-10 w-10 rounded-full" /></div>{tarjetas(3, 'progreso')}</>;
  } else if (panel === 'extractos') {
    contenido = <><section className="flex h-44 flex-col items-center justify-center gap-3 rounded-[var(--fin-r-card)] border-2 border-dashed border-[var(--fin-line)] bg-[var(--fin-card)]"><Skeleton className="h-12 w-12 rounded-2xl" /><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-52 max-w-full" /></section><Skeleton className="h-12 w-full rounded-full" /></>;
  } else if (panel === 'atajos') {
    contenido = <><section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5"><Skeleton className="h-4 w-40" /><Skeleton className="mt-3 h-3 w-full" /><Skeleton className="mt-2 h-3 w-4/5" /></section>{[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-4 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4"><Skeleton className="h-11 w-11 rounded-2xl" /><div className="flex-1"><Skeleton className="h-4 w-2/3" /><Skeleton className="mt-2 h-3 w-1/2" /></div><Skeleton className="h-7 w-12 rounded-full" /></div>)}</>;
  } else if (panel === 'revisiones') {
    contenido = <><section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4"><Skeleton className="h-11 w-full rounded-full" /></section>{lista(4)}</>;
  } else if (panel === 'gmf') {
    contenido = <><section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5"><Skeleton className="h-3 w-32" /><Skeleton className="mt-3 h-8 w-40" /><Skeleton className="mt-2 h-3 w-2/3" /></section><div className="grid grid-cols-2 gap-3">{tarjetas(2, 'opcion')}</div>{campos(2)}</>;
  } else if (panel === 'nombres') {
    contenido = <><section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4"><Skeleton className="h-11 w-full rounded-full" /></section>{tarjetas(3, 'opcion')}</>;
  } else if (panel === 'contraseña') {
    contenido = <section className="flex flex-col gap-5 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">{campos(3)}<Skeleton className="h-12 w-full rounded-full" /></section>;
  } else if (panel === 'respaldo') {
    contenido = <><section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5"><Skeleton className="h-5 w-40" /><Skeleton className="mt-3 h-3 w-full" /><div className="mt-5 flex gap-3"><Skeleton className="h-11 flex-1 rounded-full" /><Skeleton className="h-11 flex-1 rounded-full" /></div></section>{tarjetas(2, 'opcion')}</>;
  } else if (panel === 'funciones-solicitadas') {
    contenido = <><Skeleton className="h-12 w-full rounded-full" />{tarjetas(3, 'idea')}</>;
  } else if (panel === 'cuenta') {
    contenido = <><section className="flex items-center gap-4 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5"><Skeleton className="h-14 w-14 rounded-full" /><div className="flex-1"><Skeleton className="h-4 w-2/3" /><Skeleton className="mt-2 h-3 w-1/2" /></div></section>{lista(4, false)}</>;
  } else {
    contenido = <><section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">{campos(2)}<Skeleton className="mt-5 h-12 w-full rounded-full" /></section>{lista(2)}</>;
  }

  const anchoTitulo = etiqueta.length > 24 ? 'w-52' : etiqueta.length > 15 ? 'w-44' : 'w-32';
  return <Contenedor pantalla={`panel-${panel}`} etiqueta={etiqueta}><Titulo ancho={anchoTitulo} />{contenido}</Contenedor>;
};

export const SkeletonDeSeccion: React.FC<{ seccion: SectionId; panel?: PanelAjustes | null }> = ({ seccion, panel = null }) => {
  if (panel) return <SkeletonPanel panel={panel} />;
  if (seccion === 'dinero') return <Contenedor pantalla="dinero" etiqueta="Dinero"><SkeletonDinero /></Contenedor>;
  if (seccion === 'mes') return <Contenedor pantalla="mes" etiqueta="Mes"><SkeletonMes /></Contenedor>;
  if (seccion === 'asesor') return <Contenedor pantalla="asesor" etiqueta="Asesor"><SkeletonAsesor /></Contenedor>;
  if (seccion === 'ajustes') return <Contenedor pantalla="ajustes" etiqueta="Más"><SkeletonAjustes /></Contenedor>;
  if (seccion === 'calendario') return <Contenedor pantalla="calendario" etiqueta="Calendario"><SkeletonCalendario /></Contenedor>;
  return <SkeletonInicio />;
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

/** Evita que una espera de red o de un módulo deje el esqueleto en pantalla para siempre. */
export const CargaSeccion: React.FC<{ seccion: SectionId; panel?: PanelAjustes | null }> = ({ seccion, panel = null }) => {
  const [vencida, setVencida] = useState(false);
  const etiqueta = panel ? PANELES_AJUSTES.find((item) => item.id === panel)?.label ?? 'esta pantalla' :
    seccion === 'dinero' ? 'Dinero' : seccion === 'mes' ? 'Mes' : seccion === 'asesor' ? 'Asesor' : seccion === 'calendario' ? 'Calendario' : seccion === 'ajustes' ? 'Más' : 'Inicio';

  useEffect(() => {
    const temporizador = window.setTimeout(() => setVencida(true), 22_000);
    return () => window.clearTimeout(temporizador);
  }, []);

  return vencida ? <MensajeReintento etiqueta={etiqueta} /> : <SkeletonDeSeccion seccion={seccion} panel={panel} />;
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
      const etiqueta = this.props.panel ? 'esta pantalla' : this.props.seccion === 'dinero' ? 'Dinero' : this.props.seccion === 'mes' ? 'Mes' : this.props.seccion === 'asesor' ? 'Asesor' : 'esta pantalla';
      return <MensajeReintento etiqueta={etiqueta} />;
    }
    return this.props.children;
  }
}

export const SkeletonAcceso: React.FC = () => (
  <Contenedor pantalla="acceso" etiqueta="tu cuenta">
    <div className="mx-auto mt-8 flex w-full max-w-md flex-col items-center gap-4"><Skeleton className="h-20 w-20 rounded-3xl" /><Skeleton className="h-9 w-36" /><Skeleton className="h-4 w-64 max-w-full" /></div>
    <div className="mx-auto mt-5 flex w-full max-w-md flex-col gap-6 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-6">
      <Skeleton className="h-12 w-full rounded-full" /><Skeleton className="h-4 w-48" /><Skeleton className="h-14 w-full rounded-2xl" /><Skeleton className="h-4 w-28" /><Skeleton className="h-14 w-full rounded-2xl" /><Skeleton className="h-14 w-full rounded-full" />
    </div>
  </Contenedor>
);
