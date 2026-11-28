import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChartNoAxesColumnIncreasing, ChevronDown, CornerDownRight, Plus, Sparkles } from 'lucide-react';
import { TextoMarkdown } from './TextoMarkdown';
import { leerRespuestaVisual, type BloqueAsesor, type HallazgoAsesor, type PropuestaSugeridaAsesor, type SeccionAccionAsesor } from '../lib/bloquesAsesor';

interface CifraResumen {
  valor: number;
  textoOriginal: string;
}

interface CategoriaResumen {
  nombre: string;
  valor: number;
}

interface ResumenFinanciero {
  periodo: string;
  ingresos: CifraResumen;
  gastos: CifraResumen;
  balance: CifraResumen;
  categorias: CategoriaResumen[];
}

const normalizar = (texto: string): string => texto
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es-CO');

const convertirMonto = (numeroOriginal: string, unidadOriginal = ''): number => {
  let numero = numeroOriginal.replace(/\s/g, '');
  const separadores = [...numero.matchAll(/[.,]/g)];
  if (separadores.length) {
    const ultimo = separadores[separadores.length - 1];
    const decimales = numero.length - (ultimo.index ?? 0) - 1;
    if (separadores.length === 1 && decimales <= 2) {
      numero = numero.replace(',', '.');
    } else if (separadores.length > 1 && decimales <= 2) {
      const indice = ultimo.index ?? 0;
      numero = `${numero.slice(0, indice).replace(/[.,]/g, '')}.${numero.slice(indice + 1)}`;
    } else {
      numero = numero.replace(/[.,]/g, '');
    }
  }
  const base = Number(numero);
  if (!Number.isFinite(base)) return 0;
  const unidad = unidadOriginal.toLocaleLowerCase('es-CO');
  const multiplicador = /^(m|millones?)$/.test(unidad) ? 1_000_000 : /^(k|mil)$/.test(unidad) ? 1_000 : 1;
  return base * multiplicador;
};

const leerCifra = (texto: string, etiquetas: RegExp): CifraResumen | null => {
  const coincidencia = etiquetas.exec(texto);
  if (!coincidencia) return null;
  const valor = convertirMonto(coincidencia[1], coincidencia[2]);
  return { valor, textoOriginal: coincidencia[0].trim() };
};

const cifrasDeCategoria = (texto: string): CategoriaResumen[] => {
  const normalizado = normalizar(texto);
  const inicio = normalizado.search(/principales? gastos?|gastos? principales?/);
  if (inicio < 0) return [];
  const recomendacion = normalizado.slice(inicio).search(/recomendacion|proximo paso/);
  const tramo = texto.slice(inicio, recomendacion >= 0 ? inicio + recomendacion : undefined);
  const dosPuntos = tramo.indexOf(':');
  const lista = dosPuntos >= 0 ? tramo.slice(dosPuntos + 1) : tramo;
  // Las respuestas pueden escribir los miles con punto, coma o espacios. Si
  // solo leemos hasta la primera coma, "$5,146,054" termina convertido en 5.
  const monto = String.raw`(?:\d{1,3}(?:[.,]\d{3})+|\d{1,3}(?:\s\d{3})+|\d+(?:[.,]\d{1,2})?)`;
  const entradas = new RegExp(
    String.raw`([\p{L}][\p{L} '\-]{1,34}?)\s*(?::|≈|~)\s*(?:≈|~)?\s*\$?\s*(${monto})\s*(millones?|m|mil|k)?\s*(?:cop)?(?=\s*(?:,|;|\by\b|[.!?]?\s*$))`,
    'giu',
  );
  const categorias: CategoriaResumen[] = [];
  for (const coincidencia of lista.matchAll(entradas)) {
    const valor = convertirMonto(coincidencia[2], coincidencia[3]);
    if (valor > 0) categorias.push({ nombre: coincidencia[1].trim(), valor });
    if (categorias.length >= 4) break;
  }
  return categorias;
};

const analizarResumen = (texto: string): ResumenFinanciero | null => {
  const encabezado = /resumen financiero(?:\s*\(([^)]+)\))?/i.exec(texto);
  if (!encabezado) return null;
  const ingresos = leerCifra(texto, /ingresos?\s+(?:totales?|del periodo|del mes)[^\d$+-]{0,30}(?:cop\s*)?\$?\s*([+-]?\s*\d[\d.,]*)(?:\s*(millones?|m|mil|k))?/i);
  const gastos = leerCifra(texto, /gastos?\s+(?:totales?|del periodo|del mes)[^\d$+-]{0,30}(?:cop\s*)?\$?\s*([+-]?\s*\d[\d.,]*)(?:\s*(millones?|m|mil|k))?/i);
  const balance = leerCifra(texto, /balance(?:\s+acumulado|\s+del periodo|\s+del mes)?[^\d$+-]{0,30}(?:cop\s*)?\$?\s*([+-]?\s*\d[\d.,]*)(?:\s*(millones?|m|mil|k))?/i);
  if (!ingresos || !gastos || !balance) return null;
  return {
    periodo: encabezado[1]?.trim() ?? '',
    ingresos,
    gastos,
    balance,
    categorias: cifrasDeCategoria(texto),
  };
};

const formatoCop = (valor: number): string => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
}).format(valor);

const crearMiniTips = (resumen: ResumenFinanciero): string[] => {
  const balance = resumen.balance.valor;
  const consejoBalance = balance > 0
    ? 'Tu balance quedó en positivo. Si te queda cómodo, reserva una cantidad pequeña al recibir tu próximo ingreso y deja que crezca a tu ritmo.'
    : balance === 0
      ? 'El periodo quedó equilibrado. Una cantidad pequeña y constante para una meta puede avanzar sin apretarte.'
      : 'El periodo estuvo más ajustado. Primero cuida lo importante; cuando aparezca un margen, empezar con algo simbólico también cuenta.';

  const categoriaPrincipal = resumen.categorias
    .filter((categoria) => !/transfer|traslado|movimiento entre cuentas/.test(normalizar(categoria.nombre)))
    .sort((a, b) => b.valor - a.valor)[0];
  const consejoCategoria = categoriaPrincipal
    ? `Tu rubro más alto fue ${categoriaPrincipal.nombre}. Tenerlo previsto desde el inicio puede dejar espacio para una meta, sin recortar de golpe.`
    : 'Ponerle nombre a una meta personal puede hacer más fácil reservar un poquito cuando te quede cómodo.';

  return [consejoBalance, consejoCategoria];
};

const TarjetaCifra: React.FC<{ etiqueta: string; cifra: CifraResumen; tono: 'ingreso' | 'gasto' | 'balance' }> = ({ etiqueta, cifra, tono }) => {
  const color = tono === 'ingreso'
    ? 'border-emerald-700 bg-gradient-to-br from-emerald-700 via-green-700 to-teal-800 text-white shadow-lg shadow-emerald-700/20'
    : tono === 'gasto'
      ? 'border-rose-700 bg-gradient-to-br from-rose-700 via-pink-700 to-fuchsia-800 text-white shadow-lg shadow-rose-700/20'
      : cifra.valor < 0
        ? 'border-rose-700 bg-gradient-to-br from-rose-700 via-pink-700 to-fuchsia-800 text-white shadow-lg shadow-rose-700/20'
        : 'border-emerald-700 bg-gradient-to-br from-green-700 via-emerald-700 to-teal-800 text-white shadow-lg shadow-emerald-700/20';
  const Icono = tono === 'gasto' || (tono === 'balance' && cifra.valor < 0) ? ArrowDownRight : ArrowUpRight;
  return (
    <div className={`min-w-0 rounded-2xl border p-3.5 transition-transform duration-200 hover:-translate-y-0.5 ${color}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/90"><Icono className="h-3.5 w-3.5" />{etiqueta}</div>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-base font-extrabold leading-tight tabular-nums text-white sm:text-lg">
        <span className="break-words">{formatoCop(cifra.valor)}</span>
        <span className="text-[9px] font-bold tracking-wide text-white/80">COP</span>
      </p>
    </div>
  );
};

const BarrasCategorias: React.FC<{ periodo: string; items: { nombre: string; valorCop: number }[] }> = ({ periodo, items }) => {
  const mayor = Math.max(...items.map((item) => item.valorCop), 1);
  return (
    <div className="rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-3">
      <p className="mb-2 text-[11px] font-extrabold text-[var(--fin-ink)]">¿En qué se concentraron tus gastos?{periodo && <span className="font-semibold text-[var(--fin-ink-soft)]"> · {periodo}</span>}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={`${item.nombre}-${item.valorCop}`}>
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate font-semibold capitalize text-[var(--fin-ink-soft)]">{item.nombre}</span>
              <span className="shrink-0 font-bold tabular-nums text-[var(--fin-out)]">{formatoCop(item.valorCop)} <span className="text-[9px]">COP</span></span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--fin-out-bg)] shadow-inner">
              <div className="h-full rounded-full bg-[var(--fin-out)]" style={{ width: `${Math.max(6, item.valorCop / mayor * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Ingresos en verde y gastos en rojo, mes a mes: el color conserva su significado. */
const Tendencia: React.FC<{ items: Extract<BloqueAsesor, { tipo: 'tendencia' }>['items'] }> = ({ items }) => {
  const mayor = Math.max(...items.flatMap((item) => [item.ingresosCop, item.gastosCop]), 1);
  return (
    <div className="rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-extrabold text-[var(--fin-ink)]">Así vienen tus meses</p>
        <p className="flex items-center gap-3 text-[10px] font-semibold text-[var(--fin-ink-soft)]">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--fin-in)]" />Entró</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--fin-out)]" />Salió</span>
        </p>
      </div>
      <div className="flex h-28 items-end gap-2" role="img" aria-label={items.map((item) => `${item.etiqueta}: entró ${formatoCop(item.ingresosCop)}, salió ${formatoCop(item.gastosCop)}`).join('; ')}>
        {items.map((item) => (
          <div key={item.mes} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
            <div className="flex min-h-0 flex-1 items-end justify-center gap-0.5">
              <div className="w-1/2 max-w-4 rounded-t bg-[var(--fin-in)]" style={{ height: `${Math.max(2, item.ingresosCop / mayor * 100)}%` }} />
              <div className="w-1/2 max-w-4 rounded-t bg-[var(--fin-out)]" style={{ height: `${Math.max(2, item.gastosCop / mayor * 100)}%` }} />
            </div>
            <span className="truncate text-center text-[10px] font-semibold text-[var(--fin-ink-soft)]">{item.etiqueta}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const colorDeTono = (tono: string): string =>
  tono === 'atento' ? 'var(--fin-out)' : tono === 'bien' ? 'var(--fin-in)' : 'var(--fin-ink-faint)';

const NOMBRE_SECCION: Record<SeccionAccionAsesor, string> = { inicio: 'Inicio', dinero: 'Dinero', mes: 'Mes' };

const Bloque: React.FC<{ bloque: BloqueAsesor; onIrASeccion?: (seccion: SeccionAccionAsesor) => void }> = ({ bloque, onIrASeccion }) => {
  switch (bloque.tipo) {
    case 'cifras':
      return (
        <div>
          {bloque.periodo && <p className="mb-1.5 text-[11px] font-bold text-[var(--fin-ink-soft)]">{bloque.periodo}</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <TarjetaCifra etiqueta="Ingresos" cifra={{ valor: bloque.ingresosCop, textoOriginal: '' }} tono="ingreso" />
            <TarjetaCifra etiqueta="Gastos" cifra={{ valor: bloque.gastosCop, textoOriginal: '' }} tono="gasto" />
            <TarjetaCifra etiqueta="Balance" cifra={{ valor: bloque.balanceCop, textoOriginal: '' }} tono="balance" />
          </div>
        </div>
      );
    case 'barras_categorias':
      return <BarrasCategorias periodo={bloque.periodo} items={bloque.items} />;
    case 'tendencia':
      return <Tendencia items={bloque.items} />;
    case 'alerta':
      return (
        <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-3">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorDeTono(bloque.tono) }} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-[var(--fin-ink)]">{bloque.titulo}</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">{bloque.detalle}</p>
          </div>
        </div>
      );
    case 'accion':
      return onIrASeccion ? (
        <button
          type="button"
          onClick={() => onIrASeccion(bloque.seccion)}
          className="inline-flex items-center gap-1.5 rounded-[var(--fin-r-control,0.75rem)] bg-[var(--fin-accent)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-on-accent)] transition-opacity hover:opacity-90"
        >
          {bloque.etiqueta}<ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fin-line)] px-3 py-1.5 text-[12px] font-semibold text-[var(--fin-ink-soft)]">
          {bloque.etiqueta} → {NOMBRE_SECCION[bloque.seccion]}
        </span>
      );
  }
};

const ETIQUETA_TONO: Record<HallazgoAsesor['tono'], string> = {
  atento: 'Ojo con esto',
  bien: 'Buenas noticias',
  neutral: 'Algo que noté',
};

/**
 * Lo que Luki notó sin que se lo preguntaran. Va separado de la respuesta para
 * que se lea como un aparte del asesor, no como parte de lo que se pidió.
 */
export const etiquetaPropuesta = (propuesta: PropuestaSugeridaAsesor): string =>
  propuesta.tipo === 'presupuesto'
    ? `Crear tope de ${formatoCop(propuesta.montoCop)}`
    : `Crear meta «${propuesta.nombre}»`;

export const HallazgoProactivo: React.FC<{
  hallazgo: HallazgoAsesor;
  onPreguntar?: (pregunta: string) => void;
  onUsarPropuesta?: (propuesta: PropuestaSugeridaAsesor) => void;
  deshabilitado?: boolean;
}> = ({ hallazgo, onPreguntar, onUsarPropuesta, deshabilitado }) => (
  <aside className={`asesor-hallazgo asesor-hallazgo--${hallazgo.tono} rounded-2xl p-3`} aria-label="Algo que Luki notó en tus finanzas">
    <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--asesor-hallazgo-tinta)]">
      <Sparkles className="h-3 w-3" aria-hidden="true" />{ETIQUETA_TONO[hallazgo.tono]}
    </p>
    <p className="mt-1 text-[14px] font-extrabold leading-snug text-[var(--fin-ink)]">{hallazgo.titulo}</p>
    <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">{hallazgo.detalle}</p>
    {((hallazgo.propuesta && onUsarPropuesta) || (hallazgo.pregunta && onPreguntar)) && (
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {hallazgo.propuesta && onUsarPropuesta && (
          <button
            type="button"
            disabled={deshabilitado}
            onClick={() => onUsarPropuesta(hallazgo.propuesta!)}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--fin-accent)] px-3 py-1.5 text-[12px] font-bold text-[var(--fin-on-accent)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />{etiquetaPropuesta(hallazgo.propuesta)}
          </button>
        )}
        {hallazgo.pregunta && onPreguntar && (
          <button
            type="button"
            disabled={deshabilitado}
            onClick={() => onPreguntar(hallazgo.pregunta!)}
            className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--asesor-hallazgo-tinta)] transition-opacity hover:opacity-75 disabled:opacity-50"
          >
            {hallazgo.pregunta}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    )}
  </aside>
);

const COLOR_PUNTO: Record<HallazgoAsesor['tono'], string> = {
  atento: 'var(--fin-out)',
  bien: 'var(--fin-in)',
  neutral: 'var(--asesor-hallazgo-tinta)',
};

/**
 * El resumen con el que abre el Asesor. Un panel con una fila por hallazgo y
 * no una tarjeta grande por cada uno: en la pantalla de bienvenida comparte
 * espacio con Luki y los atajos, y tres tarjetas completas no cabían.
 */
export const ResumenProactivo: React.FC<{
  hallazgos: readonly HallazgoAsesor[];
  onPreguntar: (pregunta: string) => void;
  onUsarPropuesta?: (propuesta: PropuestaSugeridaAsesor) => void;
  deshabilitado?: boolean;
}> = ({ hallazgos, onPreguntar, onUsarPropuesta, deshabilitado }) => (
  <section className="asesor-resumen-proactivo asesor-hallazgo w-full min-w-0 rounded-2xl p-1.5 text-left" aria-label="Lo que Luki notó en tus finanzas">
    <p className="flex items-center gap-1.5 px-2.5 pb-1 pt-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--asesor-hallazgo-tinta)]">
      <Sparkles className="h-3 w-3" aria-hidden="true" />Esto noté en tus finanzas
    </p>
    <ul>
      {hallazgos.map((hallazgo) => (
        <li key={hallazgo.id} className="asesor-resumen-fila flex items-center gap-2 rounded-xl px-1 py-0.5">
          <button
            type="button"
            disabled={deshabilitado || !hallazgo.pregunta}
            onClick={() => hallazgo.pregunta && onPreguntar(hallazgo.pregunta)}
            title={hallazgo.detalle}
            className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 py-2 text-left transition-colors hover:bg-[var(--fin-card-hover)] disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLOR_PUNTO[hallazgo.tono] }} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 block text-[13px] font-bold leading-snug text-[var(--fin-ink)]">{hallazgo.titulo}</span>
              {hallazgo.pregunta && <span className="block truncate text-[12px] text-[var(--fin-ink-faint)] group-hover:text-[var(--fin-ink-soft)]">{hallazgo.pregunta}</span>}
            </span>
          </button>
          {hallazgo.propuesta && onUsarPropuesta && (
            <button
              type="button"
              disabled={deshabilitado}
              onClick={() => onUsarPropuesta(hallazgo.propuesta!)}
              aria-label={etiquetaPropuesta(hallazgo.propuesta)}
              title={etiquetaPropuesta(hallazgo.propuesta)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--fin-line)] bg-[var(--fin-card)] px-2.5 py-1.5 text-[12px] font-bold text-[var(--fin-ink)] transition-colors hover:border-[var(--asesor-hallazgo-tinta)] hover:text-[var(--asesor-hallazgo-tinta)] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />{hallazgo.propuesta.tipo === 'presupuesto' ? 'Tope' : 'Meta'}
            </button>
          )}
        </li>
      ))}
    </ul>
  </section>
);

/**
 * Las preguntas para seguir. Se muestran solo bajo la última respuesta, como
 * en los buenos asistentes: debajo de respuestas viejas serían ruido.
 */
export const SeguimientosAsesor: React.FC<{
  seguimientos: readonly string[];
  onElegir: (texto: string) => void;
  deshabilitado?: boolean;
}> = ({ seguimientos, onElegir, deshabilitado }) => (
  <nav className="asesor-seguimientos" aria-label="Preguntas para seguir la conversación">
    <p className="mb-1 px-1 text-[11px] font-extrabold text-[var(--fin-ink-faint)]">Sigue explorando</p>
    <ul>
      {seguimientos.map((texto, indice) => (
        <li key={texto} style={{ animationDelay: `${120 + indice * 70}ms` }} className="asesor-seguimiento">
          <button
            type="button"
            disabled={deshabilitado}
            onClick={() => onElegir(texto)}
            className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-left text-[14px] font-semibold leading-snug text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card-hover)] disabled:opacity-50"
          >
            <CornerDownRight className="h-4 w-4 shrink-0 text-[var(--fin-ink-faint)] transition-colors group-hover:text-[var(--fin-accent)]" aria-hidden="true" />
            <span className="min-w-0 flex-1">{texto}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-[var(--fin-accent)] opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  </nav>
);

const MS_POR_PALABRA = 28;

/**
 * Descubre el texto palabra por palabra. La respuesta ya llegó completa y
 * limpia del servidor: se escribe en pantalla para que se lea como alguien que
 * contesta, sin el riesgo de mostrar una cifra que luego se borra.
 */
const useTextoProgresivo = (texto: string, activo: boolean, alTerminar?: () => void): { visible: string; terminado: boolean } => {
  const palabras = texto.split(/(\s+)/);
  const [cuantas, setCuantas] = useState(activo ? 0 : palabras.length);
  const alTerminarRef = useRef(alTerminar);
  alTerminarRef.current = alTerminar;
  useEffect(() => {
    if (!activo) {
      setCuantas(palabras.length);
      return;
    }
    const reducido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducido) {
      setCuantas(palabras.length);
      alTerminarRef.current?.();
      return;
    }
    // Las respuestas largas no deben tardar más de ~1,6 s en escribirse.
    const paso = Math.max(1, Math.ceil(palabras.length / (1_600 / MS_POR_PALABRA)));
    let actual = 0;
    const intervalo = window.setInterval(() => {
      actual = Math.min(palabras.length, actual + paso);
      setCuantas(actual);
      if (actual >= palabras.length) {
        window.clearInterval(intervalo);
        alTerminarRef.current?.();
      }
    }, MS_POR_PALABRA);
    return () => window.clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, activo]);
  const terminado = cuantas >= palabras.length;
  let visible = palabras.slice(0, cuantas).join('');
  // Unas negrillas a medio escribir mostrarían los asteriscos sueltos.
  if (!terminado && (visible.match(/\*\*/g)?.length ?? 0) % 2 === 1) visible += '**';
  return { visible, terminado };
};

/**
 * Pinta la respuesta del Asesor. Con bloques usa el catálogo cerrado de
 * componentes; sin ellos conserva la lectura de resúmenes en texto, que es como
 * llegan los mensajes guardados antes de los bloques.
 */
export const RespuestaAsesor: React.FC<{
  texto: string;
  bloques?: BloqueAsesor[];
  hallazgo?: HallazgoAsesor;
  onIrASeccion?: (seccion: SeccionAccionAsesor) => void;
  onPreguntar?: (pregunta: string) => void;
  onUsarPropuesta?: (propuesta: PropuestaSugeridaAsesor) => void;
  deshabilitado?: boolean;
  /** Recién llegada: el texto se escribe y lo visual aparece al terminar. */
  escribiendo?: boolean;
  onTerminoEscritura?: () => void;
}> = ({ texto: textoRecibido, bloques: bloquesRecibidos, hallazgo: hallazgoRecibido, onIrASeccion, onPreguntar, onUsarPropuesta, deshabilitado, escribiendo = false, onTerminoEscritura }) => {
  // El SuperAdmin recibe el mensaje tal como se guardó, con los bloques dentro.
  const guardada = bloquesRecibidos ? null : leerRespuestaVisual(textoRecibido);
  const texto = guardada?.texto ?? textoRecibido;
  const bloques = bloquesRecibidos ?? guardada?.bloques ?? [];
  const hallazgo = hallazgoRecibido ?? guardada?.hallazgo;
  const { visible, terminado } = useTextoProgresivo(texto, escribiendo, onTerminoEscritura);
  if (escribiendo && !terminado) {
    return <div className="w-full max-w-full" aria-busy="true"><TextoMarkdown texto={visible} /><span className="asesor-cursor" aria-hidden="true" /></div>;
  }
  if (bloques.length > 0 || hallazgo) {
    return (
      <div className={`w-full max-w-full space-y-3 ${escribiendo ? 'asesor-revela' : ''}`} aria-label="Respuesta visual del Asesor">
        <TextoMarkdown texto={texto} />
        {bloques.map((bloque, indice) => <Bloque key={`${bloque.tipo}-${indice}`} bloque={bloque} onIrASeccion={onIrASeccion} />)}
        {hallazgo && <HallazgoProactivo hallazgo={hallazgo} onPreguntar={onPreguntar} onUsarPropuesta={onUsarPropuesta} deshabilitado={deshabilitado} />}
      </div>
    );
  }

  const resumen = analizarResumen(texto);
  if (!resumen) return <TextoMarkdown texto={texto} />;

  const mayorCategoria = Math.max(...resumen.categorias.map((categoria) => categoria.valor), 1);
  const miniTips = crearMiniTips(resumen);
  return (
    <section className="w-full max-w-full space-y-3 rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-resumen-superficie,#fffdfa)] p-3 shadow-sm shadow-stone-900/5 sm:p-4" aria-label="Resumen financiero visual">
      <header className="flex flex-wrap items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25"><ChartNoAxesColumnIncreasing className="h-4 w-4" /></span>
        <h3 className="text-sm font-extrabold text-[var(--fin-ink)]">Tu resumen financiero</h3>
        {resumen.periodo && <span className="rounded-full border border-[var(--fin-line)] bg-[var(--fin-bg-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--fin-accent)]">{resumen.periodo}</span>}
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <TarjetaCifra etiqueta="Ingresos" cifra={resumen.ingresos} tono="ingreso" />
        <TarjetaCifra etiqueta="Gastos" cifra={resumen.gastos} tono="gasto" />
        <TarjetaCifra etiqueta="Balance" cifra={resumen.balance} tono="balance" />
      </div>

      {resumen.categorias.length > 0 && (
        <div className="rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-3">
          <p className="mb-2 text-[11px] font-extrabold text-[var(--fin-ink)]">¿En qué se concentraron tus gastos?</p>
          <ul className="space-y-2">
            {resumen.categorias.map((categoria) => (
              <li key={`${categoria.nombre}-${categoria.valor}`}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate font-semibold capitalize text-[var(--fin-ink-soft)]">{categoria.nombre}</span>
                  <span className="shrink-0 font-bold tabular-nums text-[var(--fin-out)]">{formatoCop(categoria.valor)} <span className="text-[9px]">COP</span></span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--fin-out-bg)] shadow-inner">
                  <div className="h-full rounded-full bg-[var(--fin-out)] shadow-sm shadow-rose-500/30" style={{ width: `${Math.max(6, categoria.valor / mayorCategoria * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {miniTips.length > 0 && (
        <div className="resumen-asesor-tip flex items-start gap-2.5 rounded-2xl p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
          <div className="min-w-0">
            <p className="mb-1 text-xs font-extrabold text-[var(--fin-ink)]">Pequeñas ideas para tu próxima meta</p>
            <ul className="space-y-1.5 text-xs leading-relaxed text-[var(--fin-ink-soft)]">
              {miniTips.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          </div>
        </div>
      )}

      <details className="group rounded-xl px-1 py-0.5 text-[11px] text-[var(--fin-ink-soft)]">
        <summary className="w-fit cursor-pointer list-none font-bold text-[var(--fin-accent)] hover:opacity-80 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1">Ver explicación completa <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></span>
        </summary>
        <div className="mt-2 border-t border-[var(--fin-line)] pt-2"><TextoMarkdown texto={texto} /></div>
      </details>
    </section>
  );
};
