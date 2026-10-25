import React from 'react';
import { ArrowDownRight, ArrowUpRight, ChartNoAxesColumnIncreasing, ChevronDown, Sparkles } from 'lucide-react';
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
  const ingresos = leerCifra(texto, /ingresos?\s+(?:totales?|del periodo|del mes)[^\d$+\-]{0,30}(?:cop\s*)?\$?\s*([+\-]?\s*\d[\d.,]*)(?:\s*(millones?|m|mil|k))?/i);
  const gastos = leerCifra(texto, /gastos?\s+(?:totales?|del periodo|del mes)[^\d$+\-]{0,30}(?:cop\s*)?\$?\s*([+\-]?\s*\d[\d.,]*)(?:\s*(millones?|m|mil|k))?/i);
  const balance = leerCifra(texto, /balance(?:\s+acumulado|\s+del periodo|\s+del mes)?[^\d$+\-]{0,30}(?:cop\s*)?\$?\s*([+\-]?\s*\d[\d.,]*)(?:\s*(millones?|m|mil|k))?/i);
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

/** Resume informes financieros extensos en indicadores y una gráfica compacta. */
export const RespuestaAsesor: React.FC<{ texto: string }> = ({ texto }) => {
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
