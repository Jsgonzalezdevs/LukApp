import React from 'react';
import { ArrowDownRight, ArrowUpRight, ChartNoAxesColumnIncreasing, ChevronDown, Lightbulb } from 'lucide-react';
import { TextoMarkdown } from './TextoMarkdown';

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
  recomendacion: string;
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
  const entradas = /([\p{L}][\p{L} '\-]{1,34}?)\s*(?::|≈|~)\s*(?:≈|~)?\s*\$?\s*(\d+(?:[.,]\d+)?)\s*(millones?|m|mil|k)?\s*(?:cop)?(?=\s*(?:,|;|\by\b|[.!?]?\s*$))/giu;
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
  const ingresos = leerCifra(texto, /ingresos?\s+(?:totales?|del periodo|del mes)[^\d$+\-]{0,30}(?:cop\s*)?\$?\s*([+\-]?\s*\d[\d.,]*)(?:\s*(millones?|m|mil|k))?/i);
  const gastos = leerCifra(texto, /gastos?\s+(?:totales?|del periodo|del mes)[^\d$+\-]{0,30}(?:cop\s*)?\$?\s*([+\-]?\s*\d[\d.,]*)(?:\s*(millones?|m|mil|k))?/i);
  const balance = leerCifra(texto, /balance(?:\s+acumulado|\s+del periodo|\s+del mes)?[^\d$+\-]{0,30}(?:cop\s*)?\$?\s*([+\-]?\s*\d[\d.,]*)(?:\s*(millones?|m|mil|k))?/i);
  if (!ingresos || !gastos || !balance) return null;
  const normalizado = normalizar(texto);
  const indiceRecomendacion = normalizado.search(/recomendacion|proximo paso/);
  const recomendacionCompleta = (() => {
    if (indiceRecomendacion < 0) return '';
    const resto = texto.slice(indiceRecomendacion);
    const dosPuntos = resto.indexOf(':');
    return (dosPuntos >= 0 ? resto.slice(dosPuntos + 1) : resto).trim();
  })();
  const recomendacion = recomendacionCompleta.split(/[;\n]/)[0].trim().slice(0, 130);
  return {
    periodo: encabezado[1]?.trim() ?? '',
    ingresos,
    gastos,
    balance,
    categorias: cifrasDeCategoria(texto),
    recomendacion,
  };
};

const formatoCop = (valor: number): string => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(valor);

const TarjetaCifra: React.FC<{ etiqueta: string; cifra: CifraResumen; tono: 'ingreso' | 'gasto' | 'balance' }> = ({ etiqueta, cifra, tono }) => {
  const color = tono === 'ingreso'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
    : tono === 'gasto'
      ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
      : cifra.valor < 0
        ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
        : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100';
  const Icono = tono === 'gasto' || (tono === 'balance' && cifra.valor < 0) ? ArrowDownRight : ArrowUpRight;
  return (
    <div className={`min-w-0 rounded-2xl border p-3 ${color}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold opacity-80"><Icono className="h-3.5 w-3.5" />{etiqueta}</div>
      <p className="mt-1 break-words text-lg font-extrabold leading-tight tabular-nums sm:text-xl">{formatoCop(cifra.valor)}</p>
    </div>
  );
};

/** Resume informes financieros extensos en indicadores y una gráfica compacta. */
export const RespuestaAsesor: React.FC<{ texto: string }> = ({ texto }) => {
  const resumen = analizarResumen(texto);
  if (!resumen) return <TextoMarkdown texto={texto} />;

  const mayorCategoria = Math.max(...resumen.categorias.map((categoria) => categoria.valor), 1);
  return (
    <section className="w-full max-w-full space-y-3" aria-label="Resumen financiero visual">
      <header className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200"><ChartNoAxesColumnIncreasing className="h-4 w-4" /></span>
        <h3 className="text-sm font-extrabold text-[var(--fin-ink)]">Tu resumen financiero</h3>
        {resumen.periodo && <span className="rounded-full bg-[var(--fin-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--fin-ink-soft)]">{resumen.periodo}</span>}
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
                  <span className="shrink-0 font-bold tabular-nums text-[var(--fin-ink)]">{formatoCop(categoria.valor)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-rose-100 dark:bg-rose-950/70">
                  <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.max(6, categoria.valor / mayorCategoria * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {resumen.recomendacion && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <p className="text-xs leading-relaxed"><strong>Un paso para ti</strong><br />{resumen.recomendacion}</p>
        </div>
      )}

      <details className="group rounded-xl px-1 py-0.5 text-[11px] text-[var(--fin-ink-soft)]">
        <summary className="w-fit cursor-pointer list-none font-semibold hover:text-[var(--fin-ink)] [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1">Ver explicación completa <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></span>
        </summary>
        <div className="mt-2 border-t border-[var(--fin-line)] pt-2"><TextoMarkdown texto={texto} /></div>
      </details>
    </section>
  );
};
