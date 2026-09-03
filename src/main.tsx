import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BarreraErrores } from './components/BarreraErrores'
import { RaizAplicacion } from './RaizAplicacion'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BarreraErrores>
      <RaizAplicacion />
    </BarreraErrores>
  </StrictMode>,
)

/* El service worker no compite con el HTML, CSS ni JS crítico. Sigue
   registrándose en todas las rutas, solo después de completar la carga. */
window.addEventListener(
  'load',
  () => {
    void import('./features/lukapp/data/registrarSW').then(({ registrarServiceWorker }) => {
      registrarServiceWorker()
    })
  },
  { once: true },
)
