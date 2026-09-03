import { lazy, Suspense } from 'react'

const PortadaPublica = lazy(() =>
  import('./features/lukapp/components/LandingLukApp').then(({ LandingLukApp }) => ({
    default: LandingLukApp,
  })),
)

/* Esta frontera mantiene Supabase, el contexto de sesión, OCR y los paneles
   financieros fuera del grafo de carga de la portada pública. */
const AplicacionPrivada = lazy(() =>
  import('./apps-dashboard/AppsRoot').then(({ AppsRoot }) => ({ default: AppsRoot })),
)

const esPwaInstalada = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const abrirAcceso = () => window.location.assign('/entrar')

/* El mismo contenido esencial vive en index.html. Repetirlo como fallback
   evita que React lo cambie por un spinner mientras llega el chunk interactivo
   y mantiene H1, propuesta de valor y CTA visibles desde el primer render. */
const ContenidoPublicoInicial = () => (
  <main id="contenido-principal" className="contenido-seo-inicial">
    <header>
      <p className="marca-seo-inicial">LukApp</p>
      <nav aria-label="Navegación principal">
        <a href="#funciones">Funciones</a>
        <a href="#cuatro-por-mil">4×1000</a>
        <a href="#privacidad">Privacidad</a>
        <a href="/entrar">Crear cuenta</a>
      </nav>
    </header>
    <section aria-labelledby="titulo-inicial">
      <h1 id="titulo-inicial">App para controlar gastos y finanzas en Colombia</h1>
      <p>
        LukApp te ayuda a registrar gastos por voz, importar extractos bancarios,
        organizar presupuestos, crear metas de ahorro y entender el 4×1000.
      </p>
      <a href="/entrar">Comenzar gratis con LukApp</a>
    </section>
    <section id="funciones" aria-labelledby="funciones-inicial">
      <h2 id="funciones-inicial">Una app para manejar tu dinero sin perder tiempo</h2>
      <p>
        Anota un gasto hablando o escribiendo, toma una foto al recibo o importa el
        PDF de tu banco colombiano. LukApp clasifica los movimientos y te muestra
        presupuestos, tendencias, deudas, ahorro y un asesor con IA.
      </p>
    </section>
    <section id="cuatro-por-mil" aria-labelledby="gmf-inicial">
      <h2 id="gmf-inicial">Control del 4×1000 para Colombia</h2>
      <p>
        Lleva el cupo exento del GMF entre tus cuentas y estima cuánto cuesta mover
        tu plata antes de hacerlo.
      </p>
    </section>
    <section id="privacidad" aria-labelledby="privacidad-inicial">
      <h2 id="privacidad-inicial">Tus datos y tus finanzas son tuyos</h2>
      <p>
        Puedes empezar sin cuenta. Tus movimientos se guardan en tu navegador y la
        sincronización en la nube es opcional.
      </p>
    </section>
  </main>
)

const CargandoAplicacion = () => (
  <div className="flex min-h-[100dvh] items-center justify-center bg-black text-white" role="status">
    Cargando LukApp…
  </div>
)

export const RaizAplicacion = () => {
  const esPortadaPublica =
    !esPwaInstalada() &&
    (window.location.pathname === '/' || window.location.pathname === '/finanzas')

  return (
    <Suspense fallback={esPortadaPublica ? <ContenidoPublicoInicial /> : <CargandoAplicacion />}>
      {esPortadaPublica ? (
        <PortadaPublica onGetStarted={abrirAcceso} onLogin={abrirAcceso} />
      ) : (
        <AplicacionPrivada />
      )}
    </Suspense>
  )
}
