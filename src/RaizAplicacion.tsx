import { lazy, Suspense } from 'react'
import { BarreraErrores } from './components/BarreraErrores'
import { LandingLukApp } from './features/lukapp/components/LandingLukApp'

const SeoContenido = lazy(() => import('./features/lukapp/components/SeoContenido'))

/* Esta frontera mantiene Supabase, el contexto de sesión, OCR y los paneles
   financieros fuera del grafo de carga de la portada pública. */
const AplicacionPrivada = lazy(() =>
  import('./apps-dashboard/AppsRoot').then(({ AppsRoot }) => ({ default: AppsRoot })),
)

const esPwaInstalada = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const abrirRegistro = () => window.location.assign('/registro')
const abrirAcceso = () => window.location.assign('/entrar')

/* La portada es la primera impresión. Si una dependencia visual falla en un
   navegador concreto, esta salida no usa animaciones ni APIs opcionales y aún
   permite conocer LukApp, crear cuenta o entrar. */
const PortadaDeRespaldo = () => (
  <main className="flex min-h-dvh items-center justify-center bg-[#fbf9f6] px-6 text-center text-[#1c1917]">
    <section className="max-w-xl">
      <p className="text-sm font-semibold text-[#772aea]">LukApp</p>
      <h1 className="mt-3 text-4xl font-bold leading-tight">Controla tus gastos sin perder tiempo.</h1>
      <p className="mt-5 text-lg leading-relaxed text-[#6b6560]">
        Registra movimientos, organiza tu presupuesto y entiende mejor tu dinero.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={abrirRegistro} className="rounded-full bg-[#772aea] px-6 py-3 font-semibold text-white">
          Crear cuenta gratis
        </button>
        <button type="button" onClick={abrirAcceso} className="rounded-full border border-[#d8d2ca] bg-white px-6 py-3 font-semibold">
          Iniciar sesión
        </button>
      </div>
    </section>
  </main>
)

const CargandoAplicacion = () => (
  <div className="flex min-h-[100dvh] items-center justify-center bg-black text-white" role="status">
    Cargando LukApp…
  </div>
)

export const RaizAplicacion = () => {
  const rutaPublica = window.location.pathname.replace(/\/+$/, '') || '/'
  if (rutaPublica === '/blog' || rutaPublica.startsWith('/blog/')) {
    return <Suspense fallback={<CargandoAplicacion />}><SeoContenido /></Suspense>
  }

  const esPortadaPublica =
    !esPwaInstalada() &&
    (window.location.pathname === '/' || window.location.pathname === '/finanzas')

  if (esPortadaPublica) {
    return (
      <BarreraErrores contenidoAlterno={<PortadaDeRespaldo />}>
        <LandingLukApp onGetStarted={abrirRegistro} onLogin={abrirAcceso} />
      </BarreraErrores>
    )
  }

  return (
    <Suspense fallback={<CargandoAplicacion />}>
      <AplicacionPrivada />
    </Suspense>
  )
}
