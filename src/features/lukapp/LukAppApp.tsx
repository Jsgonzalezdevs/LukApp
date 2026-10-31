import { CabeceraDinero } from './components/CabeceraDinero';
import { panelDeSegmentos, rutaDePanel } from './lib/navegacionFunciones';
import { ResultadosFunciones } from './components/ResultadosFunciones';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/premium-effects.css';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CloudOff, X } from 'lucide-react';
import type { Transaction } from './types';
import { COPY } from './copy';
import { byCategory, forPeriod, monthTotals } from './lib/aggregate';
import { formatCop } from './lib/formatCop';
import { bogotaDate, monthKey } from './lib/localDate';
import { claveDePeriodo, etiquetaDePeriodo, periodoAdyacente } from './lib/periodo';
import { nuevoId } from './lib/id';
import { movimientoEnBlanco } from './lib/parseTransaction';
import { parseMultipleTransactions } from './lib/parseMultipleTransactions';
import { parseComandoVoz, type ComandoVoz, type ComandoVozConfirmado } from './lib/parseComandoVoz';
import type { ParsedTransaction } from './lib/parseTransaction';
import { aprenderDe } from './lib/aprendizaje';
import { useAlmacen } from './data/useAlmacen';
import { useSincronizacion } from './data/useSincronizacion';
import { useSesion } from './data/useSesion';
import { useTema } from './data/useTema';
import { obtenerSupabase } from './data/supabase';
import { RepositorioSupabase } from './data/repositorioSupabase';
import { migrarLibroLocal, RepositorioIndexedDB, soportaIndexedDB } from './data/indexeddb';
import { RepositorioConCola } from './data/repositorioConCola';
import { crearRepositorio } from './data/crearRepositorio';
import { ColaCambios } from './data/colaCambios';
import { CargaSeccion, LimiteErrorCarga, SkeletonAcceso } from './components/Skeleton';
import { ES_PASIVO, claseDeCuenta, etiquetaTipoCajita } from './data/modelos';
import { idsPasivos, saldosPorCajita } from './lib/cajitas';










import { FILTRO_VACIO, filtrarMovimientos, filtroActivo } from './lib/filtros';
import type { Filtro } from './lib/filtros';
import {
  useAjustesGmf,
  useAjustesPeriodo,
  useAjustesPresupuesto,
  useGuiaApp,
  useModoPrivacidad,
  useMostrarAhorro,
  useMostrarEfectivoSeparado,
  useMostrarDecisiones,
  useMostrarProximosPagosInicio,
  useNovedades,
  useOnboarding,
  useRecordatorioRacha,
  useCuentaFavorita,
} from './data/usePreferencias';
import { NOVEDADES } from './novedades';
import { contactoPorApodo } from './lib/contactos';


import { calcularRacha } from './lib/racha';
import { verificarRecordatorioRacha } from './lib/recordatorioRacha';


import { crearIndiceSenales, senalesConIndice } from './lib/senales';
import { analizarAnomalias } from './lib/senalesAvanzadas';
import { ConfirmSheet } from './components/ConfirmSheet';
import type { ConfirmDraft } from './components/ConfirmSheet';
import { CatalogoProvider } from './catalogoContexto';
import { hacerCatalogo } from './categorias';



import { LukAppShell } from './components/LukAppShell';
import { InicioView } from './components/InicioView';
import { ForecastResumen } from './components/ForecastResumen';
import { useAiInsights } from './hooks/useAiInsights';
import type { Insight } from './lib/insights';
const LoginPanel = lazy(() => import('./components/LoginPanel').then(({ LoginPanel }) => ({ default: LoginPanel })));
const DineroView = lazy(() => import('./components/DineroView').then(({ DineroView }) => ({ default: DineroView })));



import { HojaPanel } from './components/HojaPanel';
import { BotonAnotar } from './components/BotonAnotar';
import { DetalleMovimiento } from './components/DetalleMovimiento';
import { AvisoGuardado } from './components/AvisoGuardado';
import type { Guardado } from './components/AvisoGuardado';
import { ConfirmarComandoVoz } from './components/ConfirmarComandoVoz';
import { Onboarding } from './components/Onboarding';
import { PANELES_AJUSTES, SECTIONS } from './sections';
import { BASE_LUKAPP, segmentosDe, useRuta } from './data/useRuta';
import type { PanelAjustes, SectionId } from './sections';

import { TemaToggle } from './components/TemaToggle';
import type { Tema } from './data/useTema';
import { TransactionList } from './components/TransactionList';

import { construirContextoFinanciero } from './lib/motorFinanciero';
import { construirContextoParaAsesor } from './lib/centroInteligenciaFinanciera';

import { PASOS_BASICOS, PASOS_POR_SECCION } from './components/guia/pasos';
import { instalarConsolaDeVistas } from './dev/consolaVistas';
import type { VistaDePrueba } from './dev/consolaVistas';
import './lukapp.css';

/* Estas vistas no forman parte del Dashboard inicial. Se descargan al abrir
   análisis, gráficas, captura o reportes, y Tesseract mantiene además su propio
   import dinámico dentro de useImageOCR. */
const AnalistaView = lazy(() =>
  import('./components/AnalistaView').then(({ AnalistaView }) => ({ default: AnalistaView })),
);
const BandejaRevision = lazy(() =>
  import('./components/BandejaRevision').then(({ BandejaRevision }) => ({ default: BandejaRevision })),
);
const AsesorView = lazy(() =>
  import('./components/AsesorView').then(({ AsesorView }) => ({ default: AsesorView })),
);
const Captura = lazy(() =>
  import('./components/Captura').then(({ Captura }) => ({ default: Captura })),
);
const MesView = lazy(() =>
  import('./components/MesView').then(({ MesView }) => ({ default: MesView })),
);
const MultiCapturaModal = lazy(() =>
  import('./components/MultiCapturaModal').then(({ MultiCapturaModal }) => ({ default: MultiCapturaModal })),
);
const ReporteFinancieroModal = lazy(() =>
  import('./components/ReporteFinancieroModal').then(({ ReporteFinancieroModal }) => ({ default: ReporteFinancieroModal })),
);
const InvitacionPremium = lazy(() =>
  import('./components/InvitacionPremium').then(({ InvitacionPremium }) => ({ default: InvitacionPremium })),
);

/**
 * Rebuilds the parser's output shape from a stored row so editing can reuse
 * ConfirmSheet untouched. Everything is reported as high confidence because the
 * user already confirmed these values once — nothing here was guessed just now.
 */
const comoParseado = (tx: Transaction): ParsedTransaction => ({
  kind: tx.kind,
  amount: tx.amountCop,
  category: tx.category,
  cuentaId: tx.cuentaId,
  description: tx.description,
  raw: tx.rawTranscript,
  confidence: 1,
  confianzaGranular: {
    monto: 1,
    tipo: 1,
    categoria: 1,
    cuenta: 1,
    metodo: 1,
  },
  needsReview: false,
  suggestedCategories: [tx.category, 'otros', 'comida', 'transporte']
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3),
  signals: {
    amountSource: 'digits',
    kindSource: 'keyword',
    categorySource: 'keyword',
    cuentaSource: 'ninguna',
    paymentMethod: 'desconocido',
    recurringPattern: 'ninguno',
    ambiguousAmount: false,
    destinatario: null,
    ubicacion: null,
    tags: [],
  },
});

/** Las cosas que se abren encima de la pantalla actual. */
type Capa = 'buscar' | null;

/**
 * Chooses how the app is reached before it renders anything.
 *
 * La aplicación solo se monta con una sesión autenticada. El modo local se
 * conserva en los tipos y repositorios por compatibilidad, pero no es una vía
 * de entrada para usuarios.
 */
export interface LukAppMainProps {
  onBack?: () => void;
  esAdmin?: boolean;
  /** Permite revisar vistas desde DevTools únicamente a un superadmin real. */
  permitirConsolaEnProduccion?: boolean;
}

export const LukAppMain: React.FC<LukAppMainProps> = (props) => {
  return <LukAppContenido {...props} />;
};

const LukAppContenido: React.FC<LukAppMainProps> = ({ onBack, esAdmin, permitirConsolaEnProduccion }) => {
  const sesion = useSesion();
  const { tema, setTema } = useTema();
  const { ruta } = useRuta();
  const segmentosIniciales = segmentosDe(ruta);
  const seccionInicial: SectionId = segmentosIniciales[0] === 'calendario'
    ? 'calendario'
    : SECTIONS.some((item) => item.id === segmentosIniciales[0])
      ? segmentosIniciales[0] as SectionId
      : 'inicio';
  const panelInicial = panelDeSegmentos(segmentosIniciales);

  if (sesion.estado.modo === 'cargando') {
    return <CargaSeccion key={`${seccionInicial}:${panelInicial ?? ''}`} seccion={seccionInicial} panel={panelInicial} />;
  }

  if (sesion.estado.modo === 'anonimo') {
    return (
      <Suspense fallback={<SkeletonAcceso />}>
        <LoginPanel sesion={sesion} tema={tema} onCambiarTema={setTema} />
      </Suspense>
    );
  }

  const cuenta = { email: sesion.estado.email, onSalir: () => void sesion.salir() };

  return (
    <LukAppPanel
      // Remounts on account change, so one user's data can never be left on
      // screen under another's session.
      key={sesion.estado.userId}
      userId={sesion.estado.userId}
      cuenta={cuenta}
      tema={tema}
      onCambiarTema={setTema}
      onBack={onBack}
      esAdmin={esAdmin}
      permitirConsolaEnProduccion={permitirConsolaEnProduccion}
    />
  );
};

interface LukAppPanelProps {
  /** Null in local mode, where storage is this device's IndexedDB. */
  userId: string | null;
  cuenta?: { email: string; onSalir: () => void };
  tema: Tema;
  onCambiarTema: (tema: Tema) => void;
  onBack?: () => void;
  esAdmin?: boolean;
  permitirConsolaEnProduccion?: boolean;
}

const LukAppPanel: React.FC<LukAppPanelProps> = ({
  userId,
  cuenta,
  tema,
  onCambiarTema,
  onBack,
  esAdmin,
  permitirConsolaEnProduccion,
}) => {
  const [migracionLista, setMigracionLista] = useState(false);
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  useEffect(() => {
    try {
      for (let indice = localStorage.length - 1; indice >= 0; indice -= 1) {
        const clave = localStorage.key(indice);
        if (clave?.startsWith('lukapp.negocio.')) localStorage.removeItem(clave);
      }
    } catch {
      // La limpieza antigua no debe impedir abrir la app si el navegador bloquea el almacenamiento.
    }
  }, []);
  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
    return () => {
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', actualizar);
    };
  }, []);
  const repositorio = useMemo(() => {
    if (!userId) return undefined;
    if (userId === 'usuario-local-pruebas') {
      return crearRepositorio().repositorio;
    }
    const cliente = obtenerSupabase();
    if (!cliente) return undefined;
    const remoto = new RepositorioSupabase(cliente, userId);

    // Sin IndexedDB (Firefox en modo privado lo rechaza de plano) no hay dónde
    // guardar una cola: se sigue hablando con Supabase directo, como siempre.
    // Sin conexión, eso vuelve a fallar como antes de este cambio — no hay
    // forma de hacerlo mejor sin un sitio persistente donde anotar lo pendiente.
    if (!soportaIndexedDB()) return remoto;

    // Nombre propio POR USUARIO: nunca el mismo `finanzas` del modo local, y
    // nunca compartido entre dos cuentas distintas en el mismo aparato. Si hoy
    // usas la app sin cuenta y mañana entras con una, o si otra persona entra
    // con la suya en este mismo computador, cada quien tiene su propia base y
    // ninguna ve ni un dato de la otra.
    const nombreDeCache = `finanzas-nube-${userId}`;
    const local = new RepositorioIndexedDB(nombreDeCache);
    const cola = new ColaCambios(nombreDeCache);
    return new RepositorioConCola(local, remoto, cola);
  }, [userId]);

  useEffect(() => {
    let cancelado = false;
    if (!userId) return undefined;
    if (!repositorio) {
      setMigracionLista(true);
      return undefined;
    }
    void migrarLibroLocal(repositorio, userId)
      .catch((error) => console.error('No se pudieron migrar los datos locales:', error))
      .finally(() => {
        if (!cancelado) setMigracionLista(true);
      });
    return () => { cancelado = true; };
  }, [repositorio, userId]);

  const almacen = useAlmacen(repositorio, migracionLista);

  // Vuelve a leer cada vez que regresas a la app. Sin esto, la app instalada en
  // la pantalla de inicio se queda con la foto del momento en que se abrió, y
  // lo que anotaste en el computador no aparece hasta cerrarla del todo.
  //
  // Va activo SIEMPRE, también sin cuenta. Con cuenta, el otro escritor es otro
  // aparato; sin cuenta, es otra pestaña del mismo navegador, que comparte la
  // misma base local. Dos pestañas abiertas mostrando saldos distintos es el
  // mismo problema, y leer de la base local no cuesta ni un viaje a internet.
  useSincronizacion({ activo: true, recargar: almacen.recargar });
  const { mostrarAhorro, setMostrarAhorro } = useMostrarAhorro();
  const { mostrarEfectivoSeparado, setMostrarEfectivoSeparado } = useMostrarEfectivoSeparado();
  const { mostrarDecisiones, setMostrarDecisiones } = useMostrarDecisiones();
  const { mostrarProximosPagos, setMostrarProximosPagos } = useMostrarProximosPagosInicio();
  const { modoPrivacidad, alternarPrivacidad } = useModoPrivacidad();
  const onboarding = useOnboarding();
  const gmf = useAjustesGmf();
  const periodoAjustes = useAjustesPeriodo();
  const presupuestoAjustes = useAjustesPresupuesto();
  const novedades = useNovedades();
  const { cuentaFavoritaId, setCuentaFavorita } = useCuentaFavorita();
  const { transacciones, cajitas, cajitaMovimientos, categorias } = almacen.datos;

  // Los nombres propios del libro son justo lo que un transcriptor general no
  // conoce. Se mandan como pistas (no como texto obligatorio) para distinguir
  // cuentas, categorías y apodos sin enseñarle al servidor todo el historial.
  const vocabularioDictado = useMemo(() => {
    const terminos = [
      ...cajitas.filter((c) => !c.archivedAt).map((c) => c.nombre),
      ...categorias.filter((c) => !c.archivedAt).map((c) => c.nombre),
      ...almacen.datos.contactos
        .filter((c) => !c.archivedAt)
        .flatMap((c) => [c.nombre, ...c.apodos]),
    ];
    const vistos = new Set<string>();
    return terminos.filter((termino) => {
      const limpio = termino.trim();
      const clave = limpio.toLocaleLowerCase('es');
      if (limpio.length < 2 || vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    }).slice(0, 30);
  }, [cajitas, categorias, almacen.datos.contactos]);

  const [pending, setPending] = useState<ParsedTransaction | null>(null);
  const [multiPending, setMultiPending] = useState<ParsedTransaction[] | null>(null);
  const [comandoPorVoz, setComandoPorVoz] = useState<ComandoVoz | null>(null);
  const [disparoDictado, setDisparoDictado] = useState(0);
  const [editando, setEditando] = useState<Transaction | null>(null);
  const [analizando, setAnalizando] = useState<Transaction | null>(null);
  // Una sola variable de navegación. Antes eran tres a la vez (la sección, la
  // pestaña de Ahorro y la de Configuración), y de ahí salían estados
  // imposibles: quedarte en una pestaña que en ese ancho de pantalla ni
  // siquiera se dibujaba, sin forma de volver.
  // La sección y el panel abierto salen de la URL, no de un useState suelto:
  // así /finanzas/movimientos y /finanzas/ajustes/cuentas son enlazables, el
  // atrás del navegador retrocede dentro de la app y recargar no te devuelve
  // al inicio.
  const { ruta, ir } = useRuta();
  const segmentos = segmentosDe(ruta);
  const section: SectionId = (() => {
    const s = SECTIONS.find((x) => x.id === segmentos[0]);
    // Calendario es una vista contextual abierta desde Mes, no un destino de
    // la barra; aun así debe ser una ruta válida para que el botón no rebote a Inicio.
    if (segmentos[0] === 'calendario') return 'calendario';
    return s ? (s.id as SectionId) : 'inicio';
  })();
  const setSection = useCallback(
    (destino: SectionId) =>
      ir(destino === 'inicio' ? `${BASE_LUKAPP}/app` : `${BASE_LUKAPP}/${destino}`),
    [ir],
  );
  const [mostrarReporte, setMostrarReporte] = useState(false);
  const [mostrarPlanesPremium, setMostrarPlanesPremium] = useState(false);
  const [esPrimeraPrueba, setEsPrimeraPrueba] = useState(false);
  const guia = useGuiaApp();

  /* CUÁNDO SALE LA GUÍA
     El recorrido básico espera a que termine la bienvenida: mientras esa está
     abierta tapa la pantalla entera, así que iluminar el saldo por debajo no
     señalaría nada. Después, los globos de cada sitio salen solos la primera
     vez que se entra, y solo cuando el básico ya pasó — llegar a Dinero con dos
     capas de explicación encima es exactamente lo que se quería evitar. */
  const guiaBasicaAbierta = onboarding.terminado && !guia.basicaVista;
  const pasoDeSeccion = PASOS_POR_SECCION[section];
  const guiaSeccionAbierta =
    onboarding.terminado &&
    guia.basicaVista &&
    pasoDeSeccion !== undefined &&
    !guia.seccionesVistas.includes(section);

  // La hoja de anotar se dibuja encima, sin bloquear el scroll de detrás, así
  // que al cerrarse devuelve la página donde estuviera. Al volver de anotar lo
  // que se quiere ver es el total y el movimiento recién guardado, y los dos
  // están arriba del todo.
  const cerrarCaptura = useCallback(() => {
    setPending(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const today = bogotaDate();
  const thisMonth = monthKey(today);

  const { activo: recordatorioActivo, hora: recordatorioHora } = useRecordatorioRacha();
  const infoRacha = useMemo(
    () => calcularRacha(transacciones, today),
    [transacciones, today],
  );

  // Verificación periódica del recordatorio de racha en segundo plano
  useEffect(() => {
    if (!recordatorioActivo) return;
    void verificarRecordatorioRacha(
      recordatorioActivo,
      recordatorioHora,
      infoRacha.anotadoHoy,
      infoRacha.rachaActual,
      today,
    );

    const intervalo = setInterval(() => {
      void verificarRecordatorioRacha(
        recordatorioActivo,
        recordatorioHora,
        infoRacha.anotadoHoy,
        infoRacha.rachaActual,
        today,
      );
    }, 15 * 60 * 1000);

    return () => clearInterval(intervalo);
  }, [recordatorioActivo, recordatorioHora, infoRacha.anotadoHoy, infoRacha.rachaActual, today]);
  // El período activo. Para la configuración por defecto (mensual, sin
  // desfase) esto es exactamente lo que 'month' siempre fue: 'YYYY-MM'. Con
  // cualquier otra frecuencia es la clave que le corresponda (ver lib/periodo.ts).
  const [month, setMonth] = useState(() => claveDePeriodo(today, periodoAjustes.periodo));
  // Si la frecuencia cambia (p. ej. de mensual a semanal) desde el panel de
  // Ajustes, `month` se queda con una clave en el formato de la config
  // VIEJA -- una clave mensual como '2026-08' no significa nada bajo una
  // config semanal, y calcular su etiqueta/límites con la config nueva
  // producía basura ("undefined ago – NaN"). Reanclar al período de hoy bajo
  // la config nueva es además la UX correcta: cambiar la frecuencia debería
  // aterrizar en "esta semana", no dejarte viendo una clave inválida.
  useEffect(() => {
    setMonth(claveDePeriodo(today, periodoAjustes.periodo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoAjustes.periodo]);
  // El período que contiene hoy: no se puede navegar más adelante que eso.
  const maxMonth = claveDePeriodo(today, periodoAjustes.periodo);
  const etiquetaPeriodoActivo = etiquetaDePeriodo(month, periodoAjustes.periodo);
  // El mes calendario real que contiene el período activo -- lo usan las
  // partes que a propósito se quedaron ancladas al mes calendario (GMF,
  // recurrentes, el resumen tipo Wrapped, las tendencias) sin importar la
  // frecuencia que el usuario haya elegido para el resto de la app.
  const mesCalendarioActivo =
    periodoAjustes.periodo.frecuencia === 'mensual'
      ? monthKey(month.length > 7 ? month : `${month}-01`)
      : thisMonth;

  const { totals, gastos, ingresos, delMes } = useMemo(() => {
    const mes = forPeriod(transacciones, month, periodoAjustes.periodo);
    const sorted = [...mes].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
    return {
      delMes: sorted,
      totals: monthTotals(mes),
      gastos: byCategory(mes, 'gasto'),
      ingresos: byCategory(mes, 'ingreso'),
    };
  }, [transacciones, month, periodoAjustes.periodo]);

  // Anywhere money of your own can sit: accounts and savings pockets alike.
  // Debts and cards are left out because paying one is not a transfer — it has
  // its own flow in Deudas, where the sign is inverted.
  const destinosDeTransferencia = useMemo(
    () =>
      cajitas
        .filter((c) => c.archivedAt === null && !ES_PASIVO[c.tipo])
        .map((c) => ({ id: c.id, nombre: c.nombre })),
    [cajitas],
  );

  // Bank accounts only — the field asks which ACCOUNT the money moved through.
  //
  // Debts and cards are not places money sits, and a savings pocket is not one
  // either: money reaches a cajita by being put there, which Ahorro already
  // records. Listing every balance made the picker a list of everything the app
  // knows rather than an answer to the question above it.
  const cuentasParaElegir = useMemo(
    () =>
      cajitas
        .filter((c) => c.archivedAt === null && c.tipo === 'cuenta')
        .map((c) => ({
          id: c.id,
          nombre: c.nombre,
          etiqueta: `${c.nombre} · ${etiquetaTipoCajita(c)}`,
          esBajoMonto: c.esBajoMonto,
          esFinanciera: claseDeCuenta(c) !== 'efectivo',
        })),
    [cajitas],
  );

  // Una compra dictada puede salir de una cuenta o cargarse a una tarjeta. Las
  // tarjetas no participan en transferencias internas, pero sí deben estar en
  // el parser del movimiento para que «compré con la Visa Nu» quede atribuida.
  const cuentasParaMovimientos = useMemo(
    () =>
      cajitas
        .filter((c) => c.archivedAt === null && (c.tipo === 'cuenta' || c.tipo === 'tarjeta'))
        .map((c) => ({ id: c.id, nombre: c.nombre })),
    [cajitas],
  );

  // Computed once for the visible month rather than per row: each check scans
  // the whole ledger, so doing it inside the list would repeat that scan for
  // every movement on screen.
  const conSenal = useMemo(() => {
    const indice = crearIndiceSenales(transacciones);
    return new Set(delMes.filter((t) => senalesConIndice(t, indice).length > 0).map((t) => t.id));
  }, [delMes, transacciones]);

  // Aprendido de todo el libro, no del mes visible: lo que archivaste en junio
  // también enseña. Se recalcula solo cuando cambian los movimientos, no en cada
  // tecla — el parseo ocurre al enviar, no mientras se escribe.
  const lexico = useMemo(() => aprenderDe(transacciones), [transacciones]);

  const saldosCajitas = useMemo(
    () => saldosPorCajita(cajitaMovimientos, transacciones, idsPasivos(cajitas)),
    [cajitas, cajitaMovimientos, transacciones],
  );
  const cajitasBalances = useMemo(
    () => Object.fromEntries(saldosCajitas),
    [saldosCajitas],
  );

  const handleSubmit = (text: string) => {
    const comando = parseComandoVoz(text, cajitas);
    if (comando) {
      setComandoPorVoz(comando);
      return;
    }
    const parseados = parseMultipleTransactions(text, cuentasParaMovimientos, categorias, lexico, transacciones);
    if (parseados.length > 1) {
      setMultiPending(parseados);
      return;
    }
    if (parseados.length === 1) {
      const parseado = parseados[0];
      const quien = contactoPorApodo(text, almacen.datos.contactos);
      setPending(quien ? { ...parseado, description: quien.nombre } : parseado);
    }
  };

  const handleSave = async (draft: ConfirmDraft, esPrueba = false) => {
    const id = nuevoId('tx');
    try {
      const correcto = await almacen.agregarTransaccion({
      id,
      kind: draft.kind,
      amountCop: draft.amountCop,
      category: draft.category,
      description: draft.description,
      occurredOn: draft.occurredOn || bogotaDate(),
      cuentaId: draft.cuentaId,
      rawTranscript: draft.rawTranscript,
      cuotasTotal: draft.cuotasTotal ?? null,
      cuotaCop: draft.cuotaCop ?? null,
      createdAt: new Date().toISOString(),
      });
      if (!correcto) return false;
    } catch (error) {
      console.error('Error al guardar el movimiento:', error);
      setGuardado({ id: 'error', texto: 'No se pudo guardar el movimiento', aviso: 'Revisa la conexión e inténtalo de nuevo.', permitirDeshacer: false, esError: true });
      return false;
    }
    // Jump back to the period the entry landed in, so a save is never invisible
    // because the user was browsing an older period.
    const finalDate = draft.occurredOn || bogotaDate();
    setMonth(claveDePeriodo(finalDate, periodoAjustes.periodo));
    cerrarCaptura();

    // El aviso de "quedó guardado", con Deshacer.
    const anomalia = analizarAnomalias(transacciones, draft.category, draft.amountCop);
    setGuardado({
      id,
      texto: esPrueba
        ? '✨ ¡Primer movimiento de prueba guardado!'
        : `${draft.description} · ${formatCop(draft.amountCop)}`,
      detalle: detalleDeGuardado(draft.cuentaId),
      aviso: esPrueba
        ? 'Fue un registro de prueba. Puedes modificarlo o eliminarlo en la pestaña "Movimientos".'
        : anomalia?.esAnomalía
        ? `Más de lo normal — sueles gastar ${formatCop(anomalia.promedio)} aquí.`
        : null,
    });
    return true;
  };

  const handleUpdate = async (draft: ConfirmDraft) => {
    if (!editando) return;
    // La fecha solo cambia si el selector devolvió una; si no, se respeta la
    // que ya tenía. Nunca se borra por accidente.
    const occurredOn = draft.occurredOn ?? editando.occurredOn;
    try {
      const correcto = await almacen.actualizarTransaccion({
      ...editando,
      kind: draft.kind,
      amountCop: draft.amountCop,
      category: draft.category,
      description: draft.description,
      cuentaId: draft.cuentaId,
      occurredOn,
      });
      if (!correcto) return false;
    } catch (error) {
      console.error('Error al actualizar el movimiento:', error);
      setGuardado({ id: 'error', texto: 'No se pudo actualizar el movimiento', aviso: 'Revisa la conexión e inténtalo de nuevo.', permitirDeshacer: false, esError: true });
      return false;
    }
    // Si el día se movió a otro período, la fila desaparecería del período en
    // pantalla. Saltar al período donde quedó evita que la edición parezca
    // haber borrado el movimiento — el mismo motivo por el que guardar salta
    // al período de hoy.
    setMonth(claveDePeriodo(occurredOn, periodoAjustes.periodo));
    setEditando(null);
    return true;
  };

  const [capa, setCapa] = useState<Capa>(null);
  const [filtro, setFiltro] = useState<Filtro>(FILTRO_VACIO);
  // Built here as well as in the provider: the filter runs outside the tree the
  // provider wraps, and searching by category name needs the same resolution the
  // rows are drawn with.
  const catalogoActual = useMemo(() => hacerCatalogo(categorias), [categorias]);
  const sinFiltro = !filtroActivo(filtro);

  // The month is in charge until something is being searched for, and then the
  // search takes over the whole ledger. Anything else would mean stepping back
  // through the calendar to find one movement, which is the job a search box
  // exists to remove.
  const visibles = useMemo(
    () => (sinFiltro ? (capa === 'buscar' ? transacciones : delMes) : filtrarMovimientos(transacciones, filtro, catalogoActual)),
    [sinFiltro, capa, delMes, transacciones, filtro, catalogoActual],
  );

  // ---------------------------------------------------------------- capas ---
  // Las cosas que se abren ENCIMA de la pantalla, no en vez de ella. Antes casi
  // todas eran secciones con su propio puesto en el menú; ahora son capas, que
  // es lo que siempre fueron: sitios de los que uno sale, no en los que vive.
  const panelAjustes = panelDeSegmentos(segmentos);
  const setPanelAjustes = useCallback(
    (panel: PanelAjustes | null) => ir(panel ? `${BASE_LUKAPP}${rutaDePanel(panel, section)}` : `${BASE_LUKAPP}/${section === 'inicio' ? 'app' : section}`),
    [ir, section],
  );
  // Qué grupo de "Dinero" se abrió. La lista de Dinero es solo el resumen; las
  // acciones de verdad (crear, transferir, aportar, abonar) siguen viviendo en
  // las vistas de siempre, que se abren desde aquí. Así la pantalla nueva es
  // más limpia sin que se pierda nada de lo que la app sabía hacer.
  const [panelDinero, setPanelDinero] = useState<'cuenta' | 'cajita' | 'deuda' | 'tarjeta' | null>(null);
  const [panelDineroCajitaId, setPanelDineroCajitaId] = useState<string | null>(null);
  const cuentaDeImportacion = useRef<string | null>(null);
  useEffect(() => {
    if (panelAjustes === 'extractos') {
      cuentaDeImportacion.current = new URLSearchParams(window.location.search).get('cuenta');
      return;
    }
    const anterior = cuentaDeImportacion.current;
    cuentaDeImportacion.current = null;
    if (anterior && panelAjustes === null && section === 'dinero' && cajitas.some((c) => c.id === anterior)) {
      setPanelDineroCajitaId(anterior);
      setPanelDinero('cuenta');
    }
  }, [panelAjustes, section, ruta, cajitas]);
  const [detalle, setDetalle] = useState<Transaction | null>(null);
  const [guardado, setGuardado] = useState<Guardado | null>(null);
  const [vistaPreviaPremium, setVistaPreviaPremium] = useState(false);

  // Repetir no escribe a ciegas: abre la captura con los datos del último
  // movimiento y la fecha de hoy. La persona todavía ve y confirma todo antes
  // de que el libro cambie, como en cualquier otro registro.
  const repetirMovimiento = useCallback((tx: Transaction) => {
    const base = comoParseado(tx);
    setPending({ ...base, raw: '' });
  }, []);

  const nombreDeCuenta = (id: string | null) =>
    id === null ? null : (cajitas.find((c) => c.id === id)?.nombre ?? null);

  const detalleDeGuardado = (id: string | null): string => {
    const cuenta = cajitas.find((item) => item.id === id);
    if (!cuenta) return 'Guardado en tu historial · sin cambiar un saldo';
    return cuenta.tipo === 'tarjeta'
      ? `Registrado en ${cuenta.nombre} · cupo actualizado`
      : `Guardado en ${cuenta.nombre} · saldo actualizado`;
  };

  const cerrarVistasDePrueba = useCallback(() => {
    setPending(null);
    setMultiPending(null);
    setComandoPorVoz(null);
    setEditando(null);
    setAnalizando(null);
    setDetalle(null);
    setCapa(null);
    setPanelAjustes(null);
    setPanelDinero(null);
    setPanelDineroCajitaId(null);
    setMostrarReporte(false);
    setGuardado(null);
    setVistaPreviaPremium(false);
  }, [setPanelAjustes]);

  const abrirVistaDePrueba = useCallback((vista: VistaDePrueba) => {
    cerrarVistasDePrueba();
    const categoria = categorias.find((item) => !item.archivedAt)?.id ?? 'comida';

    if (vista === 'premium') {
      setVistaPreviaPremium(true);
      return;
    }
    if (vista === 'aviso') {
      setGuardado({
        id: 'vista-previa',
        texto: `Mercado · ${formatCop(89_900)}`,
        aviso: 'Este gasto es más alto que el promedio de esta categoría.',
        permitirDeshacer: false,
      });
      return;
    }
    if (vista === 'captura') {
      const base = movimientoEnBlanco();
      setPending({
        ...base,
        amount: 29_500,
        category: categoria,
        description: 'Almuerzo de prueba',
        raw: 'Gasté 29.500 en almuerzo',
      });
      return;
    }
    if (vista === 'captura-multiple') {
      const base = movimientoEnBlanco();
      setMultiPending([
        { ...base, amount: 29_500, category: categoria, description: 'Almuerzo de prueba', raw: 'Almuerzo 29.500' },
        { ...base, amount: 12_000, category: categoria, description: 'Transporte de prueba', raw: 'Transporte 12.000' },
      ]);
      return;
    }
    if (vista === 'reporte') {
      setMostrarReporte(true);
      return;
    }
    setCapa('buscar');
  }, [categorias, cerrarVistasDePrueba]);

  // La API global se instala una sola vez. Las acciones viven en una ref para
  // que los cambios normales de datos no retiren el comando durante un render.
  const accionesConsolaRef = useRef({ abrir: abrirVistaDePrueba, cerrar: cerrarVistasDePrueba });
  accionesConsolaRef.current = { abrir: abrirVistaDePrueba, cerrar: cerrarVistasDePrueba };
  useEffect(
    () => instalarConsolaDeVistas({
      abrir: (vista) => accionesConsolaRef.current.abrir(vista),
      cerrar: () => accionesConsolaRef.current.cerrar(),
      permitirEnProduccion: permitirConsolaEnProduccion,
    }),
    [permitirConsolaEnProduccion],
  );

  const confirmarComandoVoz = async (comando: ComandoVozConfirmado) => {
    if (comando.tipo === 'transferencia') {
      if (await almacen.transferirEntreCuentas(comando) === false) return;
      setGuardado({
        id: 'operacion-voz',
        texto: `Transferiste ${formatCop(comando.montoCop)}`,
        aviso: `${nombreDeCuenta(comando.origenId)} → ${nombreDeCuenta(comando.destinoId)}`,
        permitirDeshacer: false,
      });
    } else if (comando.tipo === 'abono') {
      if (await almacen.abonarDeuda(comando) === false) return;
      setGuardado({
        id: 'operacion-voz',
        texto: `Abonaste ${formatCop(comando.montoCop)}`,
        aviso: `${nombreDeCuenta(comando.cuentaId)} → ${nombreDeCuenta(comando.deudaId)}`,
        permitirDeshacer: false,
      });
    } else if (comando.tipo === 'saldo') {
      if (await almacen.fijarSaldo(comando.cajitaId, comando.saldoCop, 'Saldo actualizado por voz') === false) return;
      setGuardado({
        id: 'operacion-voz',
        texto: `${nombreDeCuenta(comando.cajitaId)} quedó en ${formatCop(comando.saldoCop)}`,
        permitirDeshacer: false,
      });
    } else {
      const correcto = await almacen.registrarMovimiento({
        cajitaId: comando.cajitaId,
        kind: 'rendimiento',
        deltaCop: comando.montoCop,
        occurredOn: comando.occurredOn,
        nota: 'Rendimiento registrado por voz',
      });
      if (correcto === false) return;
      setGuardado({
        id: 'operacion-voz',
        texto: `Rendimiento de ${formatCop(comando.montoCop)}`,
        aviso: nombreDeCuenta(comando.cajitaId),
        permitirDeshacer: false,
      });
    }
    setComandoPorVoz(null);
  };

  // Si el usuario marcó una cuenta favorita, se usa esa. Si no, se queda en null para preguntar antes de guardar.
  const cuentaPorDefecto = cuentaFavoritaId;

  // "Para ti": Tips e insights inteligentes (híbrido: local instantáneo + IA Groq/Grok dinámica)
  const [asesorPromptInicial, setAsesorPromptInicial] = useState<string | null>(null);

  const handleConsultarTipEnAsesor = useCallback(
    (insight: Insight) => {
      const prompt = `Hola asesor, sobre este dato de mis finanzas: "${insight.titulo} - ${insight.detalle}", ¿qué análisis detallado y recomendaciones prácticas me das al respecto?`;
      setAsesorPromptInicial(prompt);
      setSection('asesor');
    },
    [setSection],
  );

  const contextoFinanciero = useMemo(
    () => construirContextoFinanciero({ ...almacen.datos, hoy: today, periodo: periodoAjustes.periodo }),
    [almacen.datos, today, periodoAjustes.periodo],
  );

  const {
    insights: rawInsights,
    cargandoIa,
    refrescar: refrescarInsights,
    tieneInsightsIa,
    tieneAsesorIa,
    tienePulsoPremium,
    esPremium,
  } = useAiInsights({
    transacciones,
    presupuestos: almacen.datos.presupuestos,
    mesCalendario: mesCalendarioActivo,
    nombreDe: (categoria) => catalogoActual.de(categoria).nombre,
    configPeriodo: periodoAjustes.periodo,
    umbralAlertaPct: presupuestoAjustes.umbralAlertaPct,
  });

  const paraTi = useMemo(
    () =>
      rawInsights.map((insight) => ({
        ...insight,
        onTocar: () => handleConsultarTipEnAsesor(insight),
      })),
    [rawInsights, handleConsultarTipEnAsesor],
  );

  const resumenPremium = useMemo(() => {
    if (!tienePulsoPremium) return null;
    const { liquidez } = contextoFinanciero;
    return {
      disponibleDiarioCop: liquidez.disponibleDiarioCop,
      dineroLibreCop: liquidez.dineroLibreCop,
      diasRestantes: liquidez.diasRestantesPeriodo,
      confianza: liquidez.confianza,
    };
  }, [contextoFinanciero, tienePulsoPremium]);

  const abrirResumenPremium = useCallback((insight: Insight | null) => {
    if (!resumenPremium) return;
    const senal = insight
      ? `Además, LukApp detectó: “${insight.titulo}: ${insight.detalle}”.`
      : 'No hay una alerta adicional prioritaria hoy.';
    handleConsultarTipEnAsesor({
      id: 'pulso-premium',
      titulo: 'Mi Pulso Premium',
      detalle: `Tengo ${formatCop(resumenPremium.disponibleDiarioCop)} para usar hoy durante los ${resumenPremium.diasRestantes} días restantes del período. ${senal} Quiero entender qué podría cambiar ese margen y cuál sería la mejor decisión ahora.`,
      tono: 'neutral',
      seccion: null,
      origenIa: true,
    });
  }, [handleConsultarTipEnAsesor, resumenPremium]);

  // El encabezado dice "Dinero disponible", no patrimonio. El patrimonio
  // incluye ahorros y todavía no descuenta reservas u obligaciones; para esta
  // cifra debe usarse la liquidez libre calculada por el motor financiero.
  const patrimonioCop = contextoFinanciero.liquidez.dineroLibreCop;

  const saldoEfectivoCop = contextoFinanciero.saldo.saldoEfectivoCop ?? 0;

  const saldoCuentasSinEfectivoCop = contextoFinanciero.saldo.saldoBancosCop ?? 0;

  if (!migracionLista || almacen.cargando) {
    return <CargaSeccion key={`${section}:${panelAjustes ?? ''}`} seccion={section} panel={panelAjustes} />;
  }

  if (almacen.error && Object.values(almacen.datos).every((lista) => lista.length === 0)) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[var(--fin-bg)] p-6 text-[var(--fin-ink)]">
        <section className="max-w-md text-center" role="alert">
          <h1 className="text-xl font-semibold">No pudimos cargar tus cuentas</h1>
          <p className="mt-3 text-[var(--fin-ink-soft)]">Revisa la conexión y vuelve a intentarlo. Tus datos no se han reemplazado por saldos en cero.</p>
          <button type="button" className="mt-6 rounded-full bg-[var(--fin-accent)] px-6 py-3 text-white" onClick={() => window.location.reload()}>Volver a cargar</button>
        </section>
      </main>
    );
  }

  const ningunModalAbierto =
    pending === null &&
    multiPending === null &&
    comandoPorVoz === null &&
    editando === null &&
    analizando === null &&
    capa === null &&
    panelAjustes === null &&
    !guiaBasicaAbierta;
  const puedeMostrarInvitacionPremium =
    userId !== null &&
    cuenta !== undefined &&
    !esAdmin &&
    section === 'inicio' &&
    onboarding.terminado &&
    !guiaSeccionAbierta &&
    ningunModalAbierto;

  return (
    <CatalogoProvider categorias={categorias}>
      <LukAppShell
        section={section}
        onSectionChange={setSection}
        onBack={onBack}
        onRefrescar={almacen.recargar}
        habilitarRefresco={ningunModalAbierto}
        accion={
          section === 'asesor' || section === 'ajustes' || !ningunModalAbierto ? null : (
            <BotonAnotar
              esPremium={esPremium}
              onDictado={handleSubmit}
              onManual={() => setPending(movimientoEnBlanco())}
              onBuscar={() => setCapa('buscar')}
              autoStartTrigger={disparoDictado}
              vocabulario={vocabularioDictado}
            />
          )
        }
      >
        <LimiteErrorCarga key={`${section}:${panelAjustes ?? ''}`} seccion={section} panel={panelAjustes}>
        <Suspense fallback={<CargaSeccion key={`${section}:${panelAjustes ?? ''}`} seccion={section} panel={panelAjustes} />}>
        {!enLinea ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-[var(--fin-r-card)] bg-[var(--fin-warn-bg)] px-4 py-3" role="status">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-warn)]" strokeWidth={2.5} />
            <p className="text-[13px] leading-relaxed text-[var(--fin-warn-ink)]">Estás sin conexión. Puedes seguir viendo lo que ya tienes; los cambios se guardan y se sincronizan al volver la señal.</p>
          </div>
        ) : null}
        {/* Storage that cannot remember has to say so — silently losing a month of
 entries is far worse than an ugly banner. */}
        {!almacen.persistente ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-[var(--fin-r-card)] bg-[var(--fin-warn-bg)] px-4 py-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-warn)]"
              strokeWidth={2.5}
            />
            <p className="text-[13px] leading-relaxed text-[var(--fin-warn-ink)]">
              {COPY.almacen.sinPersistencia}
            </p>
          </div>
        ) : null}

        {/* Anotaste algo sin señal: se ve de una en el aparato, pero le falta
            subir. El aviso desaparece solo en cuanto vuelve la conexión y la
            cola se vacía — no hace falta que la persona haga nada. */}
        {almacen.cambiosPendientes > 0 ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-[var(--fin-r-card)] bg-[var(--fin-warn-bg)] px-4 py-3">
            <CloudOff
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-warn)]"
              strokeWidth={2.5}
            />
            <p className="text-[13px] leading-relaxed text-[var(--fin-warn-ink)]">
              {almacen.cambiosPendientes === 1
                ? 'Tienes 1 cambio sin subir. Se sube solo en cuanto vuelva la conexión.'
                : `Tienes ${almacen.cambiosPendientes} cambios sin subir. Se suben solos en cuanto vuelva la conexión.`}
            </p>
          </div>
        ) : null}

        {almacen.error ? (
          <div
            className="mb-4 flex items-start gap-2.5 rounded-[var(--fin-r-card)] bg-[var(--fin-out-bg)] px-4 py-3"
            role="alert"
            aria-live="assertive"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-out)]"
              strokeWidth={2.5}
            />
            <p className="flex-1 text-[13px] leading-relaxed text-[var(--fin-out-ink)]">
              {almacen.error}
            </p>
            <button
              type="button"
              onClick={almacen.descartarError}
              aria-label={COPY.almacen.descartar}
              className="shrink-0 rounded-[var(--fin-r-control)] p-1 text-[var(--fin-out-ink)]"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        ) : null}

        {/* Transición entre las 5 secciones principales (Inicio/Dinero/Mes/
 Asesor/Ajustes): el key={section} hace que AnimatePresence trate cada
 cambio de sección como un montaje/desmontaje real, con un pequeño
 slide+fade en vez del corte seco de antes. */}
        <AnimatePresence initial={false}>
        <motion.div
          key={section}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          /* No hay animación de salida: mantener la vista anterior durante
             esos milisegundos hacía que el dashboard destellara al navegar. */
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
        {/* ------------------------------------------------------- 1. Inicio --- */}
        {section === 'inicio' ? (
          <InicioView
            etiquetaPeriodo={etiquetaPeriodoActivo}
            onCambiarMes={() => setSection('mes')}
            clavePeriodo={month}
            maxClavePeriodo={maxMonth}
            onCambiarPeriodo={setMonth}
            periodoAdyacente={(clave, delta) => periodoAdyacente(clave, delta, periodoAjustes.periodo)}
            etiquetaPeriodoDeClave={(clave) => etiquetaDePeriodo(clave, periodoAjustes.periodo)}
            onBuscar={() => setCapa('buscar')}
            onAjustes={() => setSection('ajustes')}
            patrimonioCop={patrimonioCop}
            gastosCop={totals.gastos}
            ingresosCop={totals.ingresos}
            onVerMes={() => setSection('mes')}
            onVerPagos={() => setSection('calendario')}
            obligaciones={contextoFinanciero.obligaciones}
            movimientos={delMes}
            historial={transacciones}
            conSenal={conSenal}
            onAbrirMovimiento={setDetalle}
            onRepetirMovimiento={repetirMovimiento}
            onEditarMovimiento={setEditando}
            insights={paraTi}
            cargandoIa={cargandoIa}
            onRefrescarInsights={tieneInsightsIa ? refrescarInsights : undefined}
            onConsultarAsesor={handleConsultarTipEnAsesor}
            mostrarEfectivoSeparado={mostrarEfectivoSeparado}
            saldoEfectivoCop={saldoEfectivoCop}
            saldoCuentasSinEfectivoCop={saldoCuentasSinEfectivoCop}
            modoPrivacidad={modoPrivacidad}
            onTogglePrivacidad={alternarPrivacidad}
            today={today}
            novedad={novedades.hayNovedad ? NOVEDADES[0] : null}
            onCerrarNovedad={() => novedades.marcarVista()}
            onAnotar={() => setPending(movimientoEnBlanco())}
            liquidez={contextoFinanciero.liquidez}
            entrada={{ ...almacen.datos, hoy: today, periodo: periodoAjustes.periodo }}
            mostrarDecisiones={mostrarDecisiones}
            mostrarProximosPagos={mostrarProximosPagos}
            resumenPremium={resumenPremium}
            onVerResumenPremium={abrirResumenPremium}
          />
        ) : null}

        {/* ------------------------------------------------------- 2. Dinero --- */}
        {section === 'dinero' ? (
          <DineroView
            cabecera={<CabeceraDinero periodo={month} opciones={Array.from({ length: 13 }, (_, i) => {
              const clave = periodoAdyacente(maxMonth, -i, periodoAjustes.periodo);
              return { clave, etiqueta: etiquetaDePeriodo(clave, periodoAjustes.periodo) };
            })} onPeriodo={setMonth} movimientos={transacciones} hoy={today} onAjustes={() => setSection('ajustes')} />}
            onAbrirHerramienta={setPanelAjustes}
            transacciones={transacciones}
            cajitas={cajitas}
            movimientos={cajitaMovimientos}
            mostrarAhorro={mostrarAhorro}
            modoPrivacidad={modoPrivacidad}
            cuentaFavoritaId={cuentaFavoritaId}
            onAbrir={(cajita) => {
              // Las tarjetas se administran exclusivamente en su vista: ahí
              // viven compras, abonos, saldo y configuración, sin un detalle
              // genérico paralelo que parezca una segunda tarjeta distinta.
              setPanelDineroCajitaId(ES_PASIVO[cajita.tipo] ? null : cajita.id);
              setPanelDinero(
                cajita.tipo === 'tarjeta' ? 'tarjeta' : ES_PASIVO[cajita.tipo] ? 'deuda' : cajita.tipo === 'cajita' ? 'cajita' : 'cuenta',
              );
            }}
            onAbrirTarjetas={() => {
              setPanelDineroCajitaId(null);
              setPanelDinero('tarjeta');
            }}
            onCrearAhorro={() => {
              setPanelDineroCajitaId(null);
              setPanelDinero('cajita');
            }}
            onCrear={() => {
              setPanelDineroCajitaId(null);
              setPanelDinero('cuenta');
            }}
          />
        ) : null}

        {/* ---------------------------------------------------------- 3. Mes --- */}
        {section === 'mes' ? (
          <MesView
            onAbrirHerramienta={setPanelAjustes}
            clave={month}
            config={periodoAjustes.periodo}
            maxClave={maxMonth}
            mesCalendario={mesCalendarioActivo}
            hoy={today}
            onCambiarPeriodo={setMonth}
            onAbrirCalendario={() => setSection('calendario')}
            shift={(clave, pasos) => periodoAdyacente(clave, pasos, periodoAjustes.periodo)}
            totals={totals}
            gastos={gastos}
            ingresos={ingresos}
            delMes={delMes}
            transacciones={transacciones}
            onAbrirMovimiento={setDetalle}
            topes={
              <PresupuestosView
                presupuestos={almacen.datos.presupuestos}
                transacciones={transacciones}
                clave={month}
                config={periodoAjustes.periodo}
                hoy={today}
                umbralAlertaPct={presupuestoAjustes.umbralAlertaPct}
                onCambiarUmbralAlerta={presupuestoAjustes.setUmbralAlertaPct}
                alertasActivas={presupuestoAjustes.alertasActivas}
                onCambiarAlertasActivas={presupuestoAjustes.setAlertasActivas}
                onFijar={(categoria, montoCop) =>
                  almacen.fijarPresupuesto(categoria, montoCop)
                }
                onQuitar={(categoria) => almacen.quitarPresupuesto(categoria)}
                onNuevaTransaccion={(categoria) =>
                  setPending({ ...movimientoEnBlanco(), category: categoria })
                }
              />
            }
          />
        ) : null}

        {section === 'calendario' ? <CalendarioFinancieroView contexto={contextoFinanciero} hoy={today} onAñadirPagoFijo={() => setPanelAjustes('recurrentes')} /> : null}

        {/* -------------------------------------------------------- 4. Asesor --- */}
        {section === 'asesor' ? (
          <AsesorView
            transacciones={transacciones}
            cajitas={cajitas}
            cajitasBalances={cajitasBalances}
            disponibleDiarioCop={contextoFinanciero.liquidez.disponibleDiarioCop}
            categorias={categorias}
            lexico={lexico}
            promptInicial={asesorPromptInicial}
            onLimpiarPromptInicial={() => setAsesorPromptInicial(null)}
            entradaFinanciera={{ ...almacen.datos, hoy: today, periodo: periodoAjustes.periodo }}
            contextoParaAsesor={construirContextoParaAsesor(contextoFinanciero)}
            mostrarMarcaPremium={esPremium && tieneAsesorIa}
            onCrearTransaccion={(tx) => {
              setSection('inicio');
              setPending(tx);
            }}
            onFijarPresupuesto={(categoria, montoCop) => almacen.fijarPresupuesto(categoria, montoCop)}
            onCrearMeta={(meta) => almacen.crearMeta(meta)}
          />
        ) : null}

        {/* ------------------------------------------------------ 5. Ajustes --- */}
        {section === 'ajustes' ? (
          <AjustesView
            onBuscarFunciones={() => setCapa('buscar')}
            onAbrir={setPanelAjustes}
            temaToggle={<TemaToggle tema={tema} onCambiar={onCambiarTema} />}
            cuenta={cuenta}
            mostrarAhorro={mostrarAhorro}
            onMostrarAhorro={setMostrarAhorro}
            mostrarEfectivoSeparado={mostrarEfectivoSeparado}
            onMostrarEfectivoSeparado={setMostrarEfectivoSeparado}
            mostrarDecisiones={mostrarDecisiones}
            onMostrarDecisiones={setMostrarDecisiones}
            mostrarProximosPagos={mostrarProximosPagos}
            onMostrarProximosPagos={setMostrarProximosPagos}
            esAdmin={esAdmin}
            onVolverAVerGuia={
              guiaBasicaAbierta
                ? undefined
                : () => {
                    guia.reiniciar();
                    setSection('inicio');
                  }
            }
          />
        ) : null}
        </motion.div>
        </AnimatePresence>

        <AnimatePresence>
        {panelDinero !== null ? (
          <HojaPanel
            titulo={
              panelDineroCajitaId !== null
                ? cajitas.find((c) => c.id === panelDineroCajitaId)?.nombre ?? ''
                : panelDinero === 'tarjeta'
                  ? 'Tarjetas de crédito'
                  : panelDinero === 'deuda'
                  ? 'Tarjetas y deudas'
                  : panelDinero === 'cajita'
                    ? 'Ahorros'
                    : 'Cuentas'
            }
            onCerrar={() => {
              setPanelDinero(null);
              setPanelDineroCajitaId(null);
            }}
          >
            {/* Si hay un ID específico, mostrar detalle de una sola cajita */}
            {panelDineroCajitaId !== null ? (
              (() => {
                const cajitaSeleccionada = cajitas.find((c) => c.id === panelDineroCajitaId);
                return cajitaSeleccionada ? (
                  <DetalleCajita
                    key={cajitaSeleccionada.id}
                    cajita={cajitaSeleccionada}
                    onImportar={() => { setPanelDinero(null); ir(`${BASE_LUKAPP}${rutaDePanel('extractos')}?cuenta=${encodeURIComponent(cajitaSeleccionada.id)}`); }}
                    movimientos={cajitaMovimientos}
                    transacciones={transacciones}
                    esFavorita={cajitaSeleccionada.id === cuentaFavoritaId}
                    onAlternarFavorita={(id) => setCuentaFavorita(cuentaFavoritaId === id ? null : id)}
                    onFijarSaldo={(cajitaId: string, saldo: number) => almacen.fijarSaldo(cajitaId, saldo)}
                    onActualizar={(cajita) => almacen.actualizarCajita(cajita)}
                    onEliminar={(id: string) => almacen.borrarCajita(id)}
                    onTransferir={(origenId, destinoId, montoCop) =>
                      almacen.transferirEntreCuentas({ origenId, destinoId, montoCop })
                    }
                    destinos={destinosDeTransferencia}
                  />
                ) : null;
              })()
            ) : /* Si no hay ID, mostrar lista de todas las cajitas del tipo */
            panelDinero === 'deuda' || panelDinero === 'tarjeta' ? (
              <DeudasView
                soloTipo={panelDinero === 'tarjeta' ? 'tarjeta' : 'deuda'}
                cajitas={cajitas}
                movimientos={cajitaMovimientos}
                transacciones={transacciones}
                onCrear={(datos) => almacen.crearCajita(datos)}
                onFijarSaldo={(cajitaId, saldo) => almacen.fijarSaldo(cajitaId, saldo)}
                onMovimiento={(cajitaId, kind, deltaCop, categoria, detalles) =>
                  almacen.registrarMovimiento({ cajitaId, kind, deltaCop, categoria, ...detalles })
                }
                onEliminar={(id) => almacen.borrarCajita(id)}
                onActualizar={(cajita) => almacen.actualizarCajita(cajita)}
                cuentas={cuentasParaElegir}
                onAbonar={(datos) => almacen.abonarDeuda(datos)}
              />
            ) : (
              <CajitasView
                tipo={panelDinero}
                cajitas={cajitas}
                transacciones={transacciones}
                movimientos={cajitaMovimientos}
                onCrear={(datos) => almacen.crearCajita(datos)}
                onFijarSaldo={(cajitaId, saldo) => almacen.fijarSaldo(cajitaId, saldo)}
                onMovimiento={(cajitaId, kind, deltaCop, origen) =>
                  almacen.registrarMovimiento({ cajitaId, kind, deltaCop, ...(origen ?? {}) })
                }
                onEliminar={(id) => almacen.borrarCajita(id)}
                destinos={destinosDeTransferencia}
                cuentasBancarias={cuentasParaElegir}
                onTransferir={(d) => almacen.transferirEntreCuentas(d)}
              />
            )}
          </HojaPanel>
        ) : null}
        </AnimatePresence>

        {/* ------------------------------------------- los paneles de Ajustes ---
 Cada uno se abre a pantalla completa encima de la lista. Antes eran
 pestañas escondidas tras `hidden lg:grid`, y por eso cuatro de ellos
 no existían en el celular. */}
        <AnimatePresence>
        {panelAjustes !== null ? (
          <HojaPanel
            titulo={PANELES_AJUSTES.find((p) => p.id === panelAjustes)?.label ?? ''}
            onCerrar={() => {
              const cuenta = new URLSearchParams(window.location.search).get('cuenta');
              if (panelAjustes === 'extractos' && cuenta && cajitas.some((c) => c.id === cuenta)) { setPanelDineroCajitaId(cuenta); setPanelDinero('cuenta'); }
              setPanelAjustes(null);
            }}
          >
            {panelAjustes === 'forecast' ? (
              <ForecastResumen forecast={contextoFinanciero.forecast} />
            ) : panelAjustes === 'categorias' ? (
              <CategoriasEditor
                categorias={categorias}
                transacciones={transacciones}
                onCrear={(datos) => almacen.crearCategoria(datos)}
                onActualizar={(c) => almacen.actualizarCategoria(c)}
                onArchivar={(id) => almacen.archivarCategoria(id)}
                onBorrar={(id) => almacen.borrarCategoria(id)}
              />
            ) : panelAjustes === 'topes' ? (
              <PresupuestosView
                presupuestos={almacen.datos.presupuestos}
                transacciones={transacciones}
                clave={month}
                config={periodoAjustes.periodo}
                hoy={today}
                umbralAlertaPct={presupuestoAjustes.umbralAlertaPct}
                onCambiarUmbralAlerta={presupuestoAjustes.setUmbralAlertaPct}
                alertasActivas={presupuestoAjustes.alertasActivas}
                onCambiarAlertasActivas={presupuestoAjustes.setAlertasActivas}
                onFijar={(categoria, montoCop) =>
                  almacen.fijarPresupuesto(categoria, montoCop)
                }
                onQuitar={(categoria) => almacen.quitarPresupuesto(categoria)}
                onNuevaTransaccion={(categoria) =>
                  setPending({ ...movimientoEnBlanco(), category: categoria })
                }
              />
            ) : panelAjustes === 'periodo' ? (
              <PanelPeriodo periodo={periodoAjustes.periodo} onCambiarPeriodo={periodoAjustes.setPeriodo} />
            ) : panelAjustes === 'metas' ? (
              <MetasView
                metas={almacen.datos.metas}
                cajitas={cajitas}
                movimientos={cajitaMovimientos}
                metasInteligentes={contextoFinanciero.metasInteligentes}
                onCrear={(datos) => almacen.crearMeta(datos)}
                onActualizar={(meta) => almacen.actualizarMeta(meta)}
                onEliminar={(id) => almacen.borrarMeta(id)}
              />
            ) : panelAjustes === 'recurrentes' ? (
              <RecurrentesView
                recurrentes={almacen.datos.recurrentes}
                transacciones={transacciones}
                cuentas={cuentasParaElegir}
                mes={mesCalendarioActivo}
                hoy={today}
                onCrear={(d) => almacen.crearRecurrente(d)}
                onActualizar={(r) => almacen.actualizarRecurrente(r)}
                onBorrar={(id) => almacen.borrarRecurrente(id)}
                onConfirmar={(p) => almacen.confirmarRecurrente(p)}
              />
            ) : panelAjustes === 'compartido' ? (
              <EspaciosCompartidosView
                onCerrar={() => setPanelAjustes(null)}
                userId={userId}
                onAnotarEnLukApp={(montoCop, descripcion, categoria) => {
                  const base = movimientoEnBlanco();
                  setPending({
                    ...base,
                    kind: 'gasto',
                    amount: montoCop,
                    category: categoria,
                    description: descripcion,
                    dateOverride: undefined,
                    cuentaId: null,
                    raw: `${montoCop} de ${descripcion}`,
                  });
                }}
              />
            ) : panelAjustes === 'dividir-cuenta' ? (
              <DivisionCuentasModal
                onCerrar={() => setPanelAjustes(null)}
                onAnotarMiParte={(montoCop, descripcion) => {
                  setPanelAjustes(null);
                  const base = movimientoEnBlanco();
                  setPending({
                    ...base,
                    kind: 'gasto',
                    amount: montoCop,
                    category: 'comida',
                    description: descripcion,
                    dateOverride: undefined,
                    cuentaId: null,
                    raw: `${montoCop} de ${descripcion}`,
                  });
                }}
              />
            ) : panelAjustes === 'vaquitas' ? (
              <VaquitasModal isOpen={true} onClose={() => setPanelAjustes(null)} userId={userId} />
            ) : panelAjustes === 'extractos' ? (
              <AnalistaView
                cuentaInicialId={new URLSearchParams(window.location.search).get('cuenta')}
                existentes={transacciones}
                cuentas={cuentasParaElegir}
                onImportar={(nuevos, revisiones) => almacen.importarTransacciones(nuevos, revisiones)}
                onCompletar={(movimiento) => almacen.actualizarTransaccion(movimiento)}
              />
            ) : panelAjustes === 'revisiones' ? (
              <BandejaRevision
                transacciones={transacciones}
                revisiones={almacen.datos.revisiones}
                onGuardar={almacen.guardarRevision}
                onAbrirMovimiento={(tx) => { setPanelAjustes(null); setDetalle(tx); }}
              />
            ) : panelAjustes === 'atajos' ? (
              <PanelAtajos />
            ) : panelAjustes === 'gmf' ? (
              <PanelGmf
                transacciones={transacciones}
                movimientos={cajitaMovimientos}
                mes={mesCalendarioActivo}
                anioActual={Number(bogotaDate().slice(0, 4))}
                cuentas={cuentasParaElegir}
                uvt={gmf.uvt}
                onCambiarUvt={gmf.setUvt}
                cuentasGmf={gmf.cuentasGmf}
                onCambiarCuentas={gmf.setCuentasGmf}
                regimen={gmf.regimen}
                onCambiarRegimen={gmf.setRegimen}
                cuentaExentaId={gmf.cuentaExentaId}
                onCambiarCuentaExenta={gmf.setCuentaExentaId}
              />
            ) : panelAjustes === 'nombres' ? (
              <ContactosView
                transacciones={transacciones}
                contactos={almacen.datos.contactos}
                onUnir={(a, b, nombre) => almacen.unirContactos(a, b, nombre)}
                onSeparar={(a, b, nombre) => almacen.separarContactos(a, b, nombre)}
                onRenombrar={(c) => almacen.actualizarContacto(c)}
                onDeshacer={(id) => almacen.borrarContacto(id)}
                onApodar={(clave, nombre, apodo, quitar) =>
                  almacen.apodarParte(clave, nombre, apodo, quitar)
                }
              />
            ) : panelAjustes === 'contraseña' ? (
              <PasswordRecoveryView email={cuenta?.email} />
            ) : panelAjustes === 'funciones-solicitadas' ? (
              <FuncionesSolicitadasView />
            ) : panelAjustes === 'cuenta' ? (
              <CuentaView
                userId={userId}
                cuenta={cuenta}
                syncError={almacen.error}
                cambiosPendientes={almacen.cambiosPendientes}
                onSincronizar={almacen.recargar}
              />
            ) : (
              <PanelRespaldo
                datos={almacen.datos}
                cajitasBalances={cajitasBalances}
                hoy={today}
                onRestaurar={almacen.restaurar}
                onGenerarInforme={() => {
                  setPanelAjustes(null);
                  setMostrarReporte(true);
                }}
              />
            )}
          </HojaPanel>
        ) : null}
        </AnimatePresence>

        <AnimatePresence>
        {mostrarPlanesPremium ? (
          <HojaPanel titulo="Planes y precios" onCerrar={() => setMostrarPlanesPremium(false)}>
            <CuentaView
              userId={userId}
              cuenta={cuenta}
              syncError={almacen.error}
              cambiosPendientes={almacen.cambiosPendientes}
              onSincronizar={almacen.recargar}
              soloPlan
            />
          </HojaPanel>
        ) : null}
        </AnimatePresence>

        {/* ------------------------------------------------------- el buscador --- */}
        <AnimatePresence>
        {capa === 'buscar' ? (
          <HojaPanel
            titulo="Buscar"
            onCerrar={() => {
              setCapa(null);
              setFiltro(FILTRO_VACIO);
            }}
          >
            <div className="flex flex-col gap-5">
              <BuscadorMovimientos
                incluirFunciones
                complementoConsulta={<ResultadosFunciones texto={filtro.texto} onAbrir={(destino) => { setCapa(null); setFiltro(FILTRO_VACIO); ir(`${BASE_LUKAPP}${destino}`); }} />}
                filtro={filtro}
                onCambiar={setFiltro}
                resultados={visibles}
                cuentas={cuentasParaElegir}
              />
              {visibles.length === 0 ? <p role="status" className="text-sm text-[var(--fin-ink-soft)]">No hay movimientos que coincidan con esta búsqueda.</p> : <TransactionList
                transactions={visibles}
                conSenal={conSenal}
                onAbrir={setDetalle}
                onRepetir={repetirMovimiento}
                onEditar={setEditando}
              />}
            </div>
          </HojaPanel>
        ) : null}
        </AnimatePresence>

        {/* ------------------------------------------------------------ capas --- */}

        {/* La pantalla de anotar. Sigue siendo obligatorio ver el número antes de
 que se guarde — eso no cambió. Lo que cambió es que dejó de parecer un
 formulario. */}
        {pending ? (
          <Captura
            parsed={pending}
            cajitas={cajitas}
            transacciones={transacciones}
            categorias={categorias}
            lexico={lexico}
            cuentaPorDefecto={cuentaPorDefecto}
            esPrimeraPrueba={esPrimeraPrueba}
            onSave={(draft) => {
              const eraPrueba = esPrimeraPrueba;
              setEsPrimeraPrueba(false);
              return handleSave(draft, eraPrueba);
            }}
            onCancel={() => {
              setEsPrimeraPrueba(false);
              cerrarCaptura();
            }}
            onReintentarVoz={pending.raw.trim() ? () => {
              setPending(null);
              setDisparoDictado((actual) => actual + 1);
            } : undefined}
          />
        ) : null}

        {/* Modal de confirmación para dictados/entradas múltiples */}
        {multiPending ? (
          <MultiCapturaModal
            parsedList={multiPending}
            cajitas={cajitas}
            cuentaPorDefecto={cuentaPorDefecto}
            onSaveAll={async (drafts) => {
              const movimientos = drafts.map((draft) => ({
                id: nuevoId('tx'), kind: draft.kind, amountCop: draft.amountCop,
                category: draft.category, description: draft.description,
                occurredOn: draft.occurredOn || bogotaDate(), cuentaId: draft.cuentaId,
                rawTranscript: draft.rawTranscript, cuotasTotal: draft.cuotasTotal ?? null,
                cuotaCop: draft.cuotaCop ?? null, createdAt: new Date().toISOString(),
              }));
              if (!await almacen.importarTransacciones(movimientos)) return;
              setMonth(claveDePeriodo(bogotaDate(), periodoAjustes.periodo));
              setMultiPending(null);
              setGuardado({ id: 'multi', texto: `Se guardaron ${drafts.length} movimientos`, permitirDeshacer: false });
            }}
            onCancel={() => setMultiPending(null)}
          />
        ) : null}

        {detalle ? (
          <DetalleMovimiento
            tx={detalle}
            nombreCuenta={nombreDeCuenta(detalle.cuentaId)}
            onCerrar={() => setDetalle(null)}
            onEditar={(tx) => {
              setDetalle(null);
              setEditando(tx);
            }}
            onAnalizar={(tx) => {
              setDetalle(null);
              setAnalizando(tx);
            }}
            onBorrar={async (id) => {
              const correcto = await almacen.borrarTransaccion(id);
              if (correcto) setDetalle(null);
              return correcto;
            }}
          />
        ) : null}

        {analizando ? (
          <AnalisisMovimiento
            tx={analizando}
            historial={transacciones}
            onCerrar={() => setAnalizando(null)}
          />
        ) : null}

        {/* Editar sigue usando el formulario completo de siempre, con sus seis
 campos. Es lo correcto: al corregir algo uno SÍ quiere ver todo y
 poder tocarlo. Lo que se adelgazó fue el camino de crear, no el de
 arreglar. */}
        {editando ? (
          <ConfirmSheet
            modo="editar"
            parsed={comoParseado(editando)}
            cuentas={cuentasParaElegir}
            cuentaInicial={editando.cuentaId}
            fechaInicial={editando.occurredOn}
            fechaMax={today}
            onSave={handleUpdate}
            onCancel={() => setEditando(null)}
          />
        ) : null}

        {comandoPorVoz ? (
          <ConfirmarComandoVoz
            comando={comandoPorVoz}
            cajitas={cajitas}
            saldos={saldosCajitas}
            onConfirmar={confirmarComandoVoz}
            onCancelar={() => setComandoPorVoz(null)}
            onReintentar={() => {
              setComandoPorVoz(null);
              setDisparoDictado((actual) => actual + 1);
            }}
          />
        ) : null}

        <AvisoGuardado
          guardado={guardado}
          estado={!almacen.persistente ? 'temporal' : !userId || userId === 'usuario-local-pruebas' ? 'local' : almacen.cambiosPendientes > 0 ? 'pendiente' : 'sincronizado'}
          onDeshacer={async (id) => {
            const correcto = await almacen.borrarTransaccion(id);
            if (correcto) setGuardado(null);
            return correcto;
          }}
          onCerrar={() => setGuardado(null)}
        />

        {/* La bienvenida, una pregunta a la vez. Se decide con una bandera que se
 guarda de verdad, no con `transacciones.length === 0`: así no vuelve a
 aparecer el día que alguien borre su único movimiento. */}
        {!onboarding.terminado ? (
          <Onboarding
            onTerminar={async ({ nombre, banco, claseCuenta, saldoCop }) => {
              if (nombre) onboarding.guardarNombre(nombre);
              if (banco) {
                const correcto = await almacen.crearCajita({
                  nombre: banco,
                  icon: 'wallet',
                  tipo: 'cuenta',
                  claseCuenta,
                  metaCop: null,
                  tasaEaPct: null,
                  saldoInicialCop: saldoCop,
                });
                if (correcto === false) return false;
              }
              onboarding.terminar();
              return true;
            }}
          />
        ) : null}

        {/* LA GUÍA
            Dos recorridos que nunca coinciden: el básico enseña el mapa una
            sola vez, y el de cada sitio sale al llegar por primera vez. La
            guía solo se enseña si no hay ninguna pantalla ni modal flotante abierto (Captura, Detalle, etc). */}
        {guiaBasicaAbierta && !pending && !detalle && !analizando && !editando && !mostrarReporte ? (
          <GuiaApp pasos={PASOS_BASICOS} onCerrar={guia.terminarBasica} />
        ) : null}

        {guiaSeccionAbierta && pasoDeSeccion && !pending && !detalle && !analizando && !editando && !mostrarReporte ? (
          <GuiaApp
            key={section}
            pasos={pasoDeSeccion}
            onCerrar={() => guia.marcarSeccion(section)}
          />
        ) : null}

        {mostrarReporte ? (
          <ReporteFinancieroModal
            abierto
            onCerrar={() => setMostrarReporte(false)}
            mes={mesCalendarioActivo}
            datos={almacen.datos}
            cajitasBalances={cajitasBalances}
            emailUsuario={cuenta?.email}
          />
        ) : null}

        {vistaPreviaPremium ? (
          <InvitacionPremium
            userId={userId ?? 'vista-previa-local'}
            puedeMostrarse
            vistaPrevia
            onCerrarVistaPrevia={() => setVistaPreviaPremium(false)}
            onVerOpciones={() => {
              setVistaPreviaPremium(false);
              setMostrarPlanesPremium(true);
            }}
          />
        ) : userId && cuenta && puedeMostrarInvitacionPremium ? (
          <InvitacionPremium
            userId={userId}
            puedeMostrarse={puedeMostrarInvitacionPremium}
            onVerOpciones={() => {
              setMostrarPlanesPremium(true);
            }}
          />
        ) : null}
        </Suspense>
        </LimiteErrorCarga>
      </LukAppShell>
    </CatalogoProvider>
  );
};

const ContactosView = lazy(() => import('./components/ContactosView').then((modulo) => ({ default: modulo.ContactosView })));

const BuscadorMovimientos = lazy(() => import('./components/BuscadorMovimientos').then((modulo) => ({ default: modulo.BuscadorMovimientos })));

const PanelAtajos = lazy(() => import('./components/PanelAtajos').then((modulo) => ({ default: modulo.PanelAtajos })));

const FuncionesSolicitadasView = lazy(() => import('./components/FuncionesSolicitadasView').then((modulo) => ({ default: modulo.FuncionesSolicitadasView })));

const CuentaView = lazy(() => import('./components/CuentaView').then((modulo) => ({ default: modulo.CuentaView })));

const PanelGmf = lazy(() => import('./components/PanelGmf').then((modulo) => ({ default: modulo.PanelGmf })));

const PanelRespaldo = lazy(() => import('./components/PanelRespaldo').then((modulo) => ({ default: modulo.PanelRespaldo })));

const PresupuestosView = lazy(() => import('./components/PresupuestosView').then((modulo) => ({ default: modulo.PresupuestosView })));

const PanelPeriodo = lazy(() => import('./components/PanelPeriodo').then((modulo) => ({ default: modulo.PanelPeriodo })));

const RecurrentesView = lazy(() => import('./components/RecurrentesView').then((modulo) => ({ default: modulo.RecurrentesView })));

const DivisionCuentasModal = lazy(() => import('./components/DivisionCuentasModal').then((modulo) => ({ default: modulo.DivisionCuentasModal })));

const EspaciosCompartidosView = lazy(() => import('./components/EspaciosCompartidosView').then((modulo) => ({ default: modulo.EspaciosCompartidosView })));

const CategoriasEditor = lazy(() => import('./components/CategoriasEditor').then((modulo) => ({ default: modulo.CategoriasEditor })));

const AnalisisMovimiento = lazy(() => import('./components/AnalisisMovimiento').then((modulo) => ({ default: modulo.AnalisisMovimiento })));

const CajitasView = lazy(() => import('./components/CajitasView').then((modulo) => ({ default: modulo.CajitasView })));

const DeudasView = lazy(() => import('./components/DeudasView').then((modulo) => ({ default: modulo.DeudasView })));

const MetasView = lazy(() => import('./components/MetasView').then((modulo) => ({ default: modulo.MetasView })));

const DetalleCajita = lazy(() => import('./components/DetalleCajita').then((modulo) => ({ default: modulo.DetalleCajita })));

const AjustesView = lazy(() => import('./components/AjustesView').then((modulo) => ({ default: modulo.AjustesView })));

const PasswordRecoveryView = lazy(() => import('./components/PasswordRecoveryView').then((modulo) => ({ default: modulo.PasswordRecoveryView })));

const VaquitasModal = lazy(() => import('./components/VaquitasModal').then((modulo) => ({ default: modulo.VaquitasModal })));

const CalendarioFinancieroView = lazy(() => import('./components/CalendarioFinancieroView').then((modulo) => ({ default: modulo.CalendarioFinancieroView })));

const GuiaApp = lazy(() => import('./components/guia/GuiaApp').then((modulo) => ({ default: modulo.GuiaApp })));
