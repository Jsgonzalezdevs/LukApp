import { lazy, Suspense } from 'react'
import { LandingLukApp } from './features/lukapp/components/LandingLukApp'

/* Esta frontera mantiene Supabase, el contexto de sesión, OCR y los paneles
   financieros fuera del grafo de carga de la portada pública. */
const AplicacionPrivada = lazy(() =>
  import('./apps-dashboard/AppsRoot').then(({ AppsRoot }) => ({ default: AppsRoot })),
)

const esPwaInstalada = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const abrirAcceso = () => window.location.assign('/entrar')

const CargandoAplicacion = () => (
  <div className="flex min-h-[100dvh] items-center justify-center bg-black text-white" role="status">
    Cargando LukApp…
  </div>
)

export const RaizAplicacion = () => {
  const esPortadaPublica =
    !esPwaInstalada() &&
    (window.location.pathname === '/' || window.location.pathname === '/finanzas')

  if (esPortadaPublica) {
    return <LandingLukApp onGetStarted={abrirAcceso} onLogin={abrirAcceso} />
  }

  return (
    <Suspense fallback={<CargandoAplicacion />}>
      <AplicacionPrivada />
    </Suspense>
  )
}
