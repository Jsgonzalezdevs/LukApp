import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { BrandWordmark } from './BrandWordmark';
import { Hero } from './landing/Hero';
import { MascotaLuki } from './landing/MascotaLuki';
import type { Sesion } from '../data/useSesion';
import { BarraProgreso, Ticker } from './landing/adornos';
import { Reveal } from './landing/primitivas';
import '../styles/LandingLukApp.css';

/* El hero y la navegación forman el primer viewport y llegan con el paquete
   inicial. Estas secciones viven por debajo: separarlas reduce el JS crítico
   sin volver a mostrar un fallback distinto antes de la portada. */
const DemoParser = lazy(() => import('./landing/DemoParser').then(({ DemoParser }) => ({ default: DemoParser })));
const Funciones = lazy(() => import('./landing/Funciones').then(({ Funciones }) => ({ default: Funciones })));
const Cupo4x1000 = lazy(() => import('./landing/Cupo4x1000').then(({ Cupo4x1000 }) => ({ default: Cupo4x1000 })));
const FormasDeRegistrar = lazy(() => import('./landing/FormasDeRegistrar').then(({ FormasDeRegistrar }) => ({ default: FormasDeRegistrar })));
const BandaCifras = lazy(() => import('./landing/BandaCifras').then(({ BandaCifras }) => ({ default: BandaCifras })));
const Registro = lazy(() => import('./landing/Registro').then(({ Registro }) => ({ default: Registro })));
const PWAInstall = lazy(() => import('./landing/PWAInstall').then(({ PWAInstall }) => ({ default: PWAInstall })));
const SecuenciaAnimada = lazy(() => import('./landing/SecuenciaAnimada').then(({ SecuenciaAnimada }) => ({ default: SecuenciaAnimada })));
const SeccionApplePay = lazy(() => import('./landing/SeccionApplePay').then(({ SeccionApplePay }) => ({ default: SeccionApplePay })));

/** Descarga cada sección cuando está cerca de ser visible, no al montar la
 * portada. Así el primer viewport no compite con el resto de la landing por
 * CPU, parseo y memoria, algo especialmente caro en teléfonos. */
const SeccionDiferida: React.FC<{ children: React.ReactNode; altura?: string }> = ({ children, altura = 'min(72vh, 560px)' }) => {
  const [activa, setActiva] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activa || !ref.current) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setActiva(true);
          observador.disconnect();
        }
      },
      { rootMargin: '800px 0px' },
    );
    observador.observe(ref.current);
    return () => observador.disconnect();
  }, [activa]);

  return <div ref={ref} style={!activa ? { minHeight: altura } : undefined}>{activa && <Suspense fallback={null}>{children}</Suspense>}</div>;
};

/* La cinta que corre bajo el hero. Son frases que la app de verdad entiende
   —las mismas que el visitante puede pegar en el demo de abajo— así que además
   de mover la página está enseñando el producto. */
const FRASES_TICKER = [
  'gasté 45k en pizza',
  'uber a casa 12k',
  'mercado en el éxito 180 mil',
  'me pagaron 2 millones',
  'netflix 38900',
  'le presté 50 lucas a Andrés',
  'almuerzo 15 mil con la tarjeta',
  'tanqueé 120 mil ayer',
  'arriendo 1.800.000',
  'cine con Sara 42k'
];

interface LandingProps {
  onGetStarted?: () => void;
  onLogin?: () => void;
  /**
   * Opcional para que la portada se pueda montar suelta (una vista de
   * inspección, un test) sin tener que fabricar una sesión. Sin ella no se
   * pinta el formulario de registro, que es lo único que la necesita.
   */
  sesion?: Sesion;
}

const ENLACES = [
  { href: '#finanzas-personales', texto: 'Aprende', titulo: 'Aprender sobre finanzas personales' },
  { href: '#demo', texto: 'Pruébalo', titulo: 'Probar la app de finanzas' },
  { href: '#apple-pay', texto: 'Apple Pay', titulo: 'Configurar Apple Pay con LukApp' },
  { href: '#funciones', texto: 'Funciones', titulo: 'Conocer las funciones de LukApp' },
  { href: '#cuatro-por-mil', texto: '4×1000', titulo: 'Calcular el 4x1000' },
  { href: '#registro', texto: 'Crear cuenta', titulo: 'Crear una cuenta en LukApp' }
];

export const LandingLukApp: React.FC<LandingProps> = ({
  onGetStarted,
  onLogin,
  sesion
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [compacta, setCompacta] = useState(false);
  const [mostrarPWA, setMostrarPWA] = useState(false);
  const [pwaYaVisto, setPwaYaVisto] = useState(false);
  const sesionActiva = sesion?.estado.modo === 'autenticado' || sesion?.estado.modo === 'local';

  /* La barra se encoge al bajar. `passive` porque el handler no llama a
     preventDefault y sin eso Chrome bloquea el hilo de scroll en móvil. */
  useEffect(() => {
    const alScroll = () => setCompacta(window.scrollY > 24);
    alScroll();
    window.addEventListener('scroll', alScroll, { passive: true });
    return () => window.removeEventListener('scroll', alScroll);
  }, []);

  const handleGetStarted = () => {
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android/.test(ua);

    if (isMobile && !pwaYaVisto) {
      setMostrarPWA(true);
      return;
    }

    onGetStarted?.();
  };

  const handlePWAClose = () => {
    setMostrarPWA(false);
  };

  const handlePWASkip = () => {
    setPwaYaVisto(true);
    setMostrarPWA(false);
    onGetStarted?.();
  };

  const handlePWAProceed = () => {
    setPwaYaVisto(true);
    setMostrarPWA(false);
    onGetStarted?.();
  };

  return (
    <div className="landing-finanzas">
      <a className="saltar-contenido" href="#contenido-principal">
        Saltar al contenido principal
      </a>
      <header>
        <nav className={`nav-bar ${compacta ? 'compacta' : ''}`} aria-label="Navegación principal">
          <BarraProgreso />
          <div className="nav-content">
            <a className="logo-enlace" href="/" aria-label="Inicio de LukApp">
              <BrandWordmark className="logo" />
            </a>

            <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
              {ENLACES.map(({ href, texto, titulo }) => (
                <a href={href} key={href} title={titulo} onClick={() => setMenuOpen(false)}>
                  {texto}
                </a>
              ))}
              <button
                className="link-btn"
                onClick={() => {
                  onLogin?.();
                  setMenuOpen(false);
                }}
              >
                {sesionActiva ? 'Ir a mi app' : 'Acceder'}
              </button>
            </div>
            <button
              className="menu-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={22} strokeWidth={1.75} /> : <Menu size={22} strokeWidth={1.75} />}
            </button>
          </div>
        </nav>
      </header>

      <main id="contenido-principal">
        <Hero onGetStarted={handleGetStarted} />
        <Ticker frases={FRASES_TICKER} />
        <SeccionDiferida>
          <SecuenciaAnimada />
        </SeccionDiferida>
        <SeccionDiferida>
          <DemoParser />
        </SeccionDiferida>
        <SeccionDiferida>
          <SeccionApplePay />
        </SeccionDiferida>
        <SeccionDiferida altura="220px">
          <BandaCifras />
        </SeccionDiferida>
        <SeccionDiferida>
          <Funciones />
        </SeccionDiferida>
        <SeccionDiferida>
          <Cupo4x1000 />
        </SeccionDiferida>
        <SeccionDiferida>
          <FormasDeRegistrar />
          {mostrarPWA && (
            <PWAInstall
              onClose={handlePWAClose}
              onSkip={handlePWASkip}
              onProceed={handlePWAProceed}
            />
          )}

          {sesion ? (
            <Registro sesion={sesion} onIrAEntrar={onLogin} />
          ) : (
            <section className="final-cta">
              <Reveal>
                <MascotaLuki />
                <h2>¿Listo?</h2>
                <p>Toma el control de tu dinero desde hoy.</p>
                <button className="btn-primary-lg" onClick={handleGetStarted}>
                  Comenzar ahora
                  <ArrowRight size={18} strokeWidth={2} aria-hidden />
                </button>
              </Reveal>
            </section>
          )}
        </SeccionDiferida>
      </main>

      <footer className="footer">
        <p>© 2026 LukApp — Tu dinero, bajo control</p>
      </footer>
    </div>
  );
};
