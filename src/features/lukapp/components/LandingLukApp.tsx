import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { BrandWordmark } from './BrandWordmark';
import { Hero } from './landing/Hero';
import { MascotaLuki } from './landing/MascotaLuki';
import type { Sesion } from '../data/useSesion';
import { BarraProgreso, Ticker } from './landing/adornos';
import { Reveal } from './landing/primitivas';
import '../styles/LandingLukApp.css';
import { guardarConsentimientoAnalitica, pideConsentimientoAnalitica, registrarVisita } from '../../../lib/visita';

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
  const [mostrarConsentimientoAnalitica, setMostrarConsentimientoAnalitica] = useState(pideConsentimientoAnalitica);
  const sesionActiva = sesion?.estado.modo === 'autenticado' || sesion?.estado.modo === 'local';

  /* La barra se encoge al bajar. `passive` porque el handler no llama a
     preventDefault y sin eso Chrome bloquea el hilo de scroll en móvil. */
  useEffect(() => {
    const alScroll = () => setCompacta(window.scrollY > 24);
    alScroll();
    window.addEventListener('scroll', alScroll, { passive: true });
    return () => window.removeEventListener('scroll', alScroll);
  }, []);

  useEffect(() => {
    if (window.location.hash !== '#registro') return;
    let intentos = 0;
    let id: number;
    const ubicarRegistro = () => {
      const registro = document.getElementById('registro');
      if (registro) {
        registro.scrollIntoView({ block: 'start', behavior: 'auto' });
        return;
      }
      if (intentos++ < 20) id = window.setTimeout(ubicarRegistro, 50);
    };
    ubicarRegistro();
    return () => window.clearTimeout(id);
  }, []);

  const handleGetStarted = () => {
    onGetStarted?.();
  };

  const handlePWAClose = () => {
    setMostrarPWA(false);
  };

  const handleRegistro = () => {
    window.location.hash = 'registro';
    document.getElementById('registro')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const handlePWASkip = () => {
    setMostrarPWA(false);
    onGetStarted?.();
  };

  const handlePWAProceed = () => {
    setMostrarPWA(false);
    onGetStarted?.();
  };

  return (
    <div className="landing-finanzas">
      {mostrarConsentimientoAnalitica && (
        <aside className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-xl rounded-2xl border-2 border-[var(--lp-line)] bg-[var(--lp-surface)] p-5 shadow-[0_20px_50px_rgb(0_0_0_/_0.35)]" aria-label="Preferencia de analítica">
          <p className="text-sm font-bold text-[var(--lp-ink)]">Términos y privacidad</p>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--lp-ink-soft)]">Al aceptar, confirmas que conoces nuestros <a className="font-semibold text-[var(--lp-accent)] underline decoration-2 underline-offset-2" href="/legal#terminos">Términos y condiciones</a> y nuestra <a className="font-semibold text-[var(--lp-accent)] underline decoration-2 underline-offset-2" href="/legal#privacidad">Política de privacidad</a>, incluida la analítica opcional descrita allí.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="rounded-xl bg-[var(--lp-accent)] px-4 py-2.5 text-xs font-bold text-[var(--lp-on-accent)] shadow-sm" onClick={() => { guardarConsentimientoAnalitica(true); setMostrarConsentimientoAnalitica(false); registrarVisita(); }}>Aceptar</button>
            <button type="button" className="rounded-xl bg-[var(--lp-surface-hover)] px-4 py-2.5 text-xs font-bold text-[var(--lp-ink)]" onClick={() => { guardarConsentimientoAnalitica(false); setMostrarConsentimientoAnalitica(false); }}>Declinar</button>
          </div>
        </aside>
      )}
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
                <button className="btn-primary-lg" onClick={handleRegistro}>
                  Comenzar ahora
                  <ArrowRight size={18} strokeWidth={2} aria-hidden />
                </button>
              </Reveal>
            </section>
          )}
        </SeccionDiferida>
      </main>

      <footer className="footer">
        <div className="footer-contenido">
          <div className="footer-marca">
            <BrandWordmark className="footer-logo" />
            <p>Tu dinero, bajo control.</p>
          </div>
          <div className="footer-columna">
            <h2>Legal</h2>
            <a href="/legal#privacidad">Política de privacidad</a>
            <a href="/legal#terminos">Términos y condiciones</a>
            <a href="/legal#almacenamiento">Almacenamiento y analítica</a>
            <a href="/legal#datos">Tus derechos sobre los datos</a>
          </div>
          <div className="footer-columna">
            <h2>Contacto</h2>
            <a href="mailto:jsgonzalezdevs@gmail.com">jsgonzalezdevs@gmail.com</a>
            <a href="https://www.instagram.com/lukapp.app/" target="_blank" rel="noopener noreferrer">Instagram</a>
          </div>
        </div>
        <p className="footer-copyright">© 2026 LukApp. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};
