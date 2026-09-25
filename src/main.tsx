import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BarreraErrores } from './components/BarreraErrores'
import { RaizAplicacion } from './RaizAplicacion'
import { iniciarInstalacionPwa } from './features/lukapp/data/instalacionPwa'
import { registrarServiceWorker } from './features/lukapp/data/registrarSW'

// Se registra antes de que React decida qué ruta mostrar. Chromium puede
// anunciar una PWA instalable antes de que alguien llegue al área privada.
iniciarInstalacionPwa()
registrarServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BarreraErrores>
      <RaizAplicacion />
    </BarreraErrores>
  </StrictMode>,
)
