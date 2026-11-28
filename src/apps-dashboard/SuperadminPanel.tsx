import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ShieldAlert,
  Users,
  Cpu,
  BarChart3,
  History,
  CreditCard,
  FileText,
} from 'lucide-react';
import { TemaToggle } from '../features/lukapp/components/TemaToggle';
import type { Tema } from '../features/lukapp/data/useTema';
import { obtenerSupabase } from '../features/lukapp/data/supabase';
import { useBloqueoScroll } from '../features/lukapp/data/useBloqueoScroll';
import { VERSION_ETIQUETA } from '../version';
import { FacturacionPanel } from './FacturacionPanel';
import type { TabSuperadmin } from './superadmin/tipos';
import { useUsuariosAdmin } from './superadmin/usuarios';
import { useTerminosAdmin } from './superadmin/terminos';
import { useRolesAdmin } from './superadmin/roles';
import { useAuditoriaAdmin } from './superadmin/auditoria';
import { useMetricasIAAdmin } from './superadmin/metricasIA';
import { useVisitasAdmin } from './superadmin/visitas';
import { useRachaAdmin } from './superadmin/racha';
import { PestanaUsuarios } from './superadmin/PestanaUsuarios';
import { PestanaRoles } from './superadmin/PestanaRoles';
import { PestanaTerminos } from './superadmin/PestanaTerminos';
import { PestanaIATokens } from './superadmin/PestanaIATokens';
import { PestanaTrafico } from './superadmin/PestanaTrafico';
import { PestanaAuditoria } from './superadmin/PestanaAuditoria';
import { ModalUsuario } from './superadmin/ModalUsuario';
import { ModalRol } from './superadmin/ModalRol';
import { ModalEliminarRol } from './superadmin/ModalEliminarRol';
import { ModalRacha } from './superadmin/ModalRacha';
import { ModalEliminarUsuario } from './superadmin/ModalEliminarUsuario';
import { ModalAsesorar } from './superadmin/ModalAsesorar';
import { ModalDetalleConsulta } from './superadmin/ModalDetalleConsulta';

interface SuperadminPanelProps {
  rol: 'admin' | 'usuario';
  /** Los permisos del rol personalizado, si tiene uno. Vacío para 'admin'. */
  permisos: string[];
  onBack: () => void;
  onNavigateTo?: (app: string) => void;
  /** Actualiza la raíz con el respaldo recién guardado para mostrar la salida. */
  onIniciarAsesoria?: () => void;
  tema: Tema;
  onCambiarTema: (tema: Tema) => void;
}

export const SuperadminPanel: React.FC<SuperadminPanelProps> = ({ rol, permisos, onBack, onNavigateTo, onIniciarAsesoria, tema, onCambiarTema }) => {
  // 'admin' puede todo sin mirar `permisos` -- la misma garantía que
  // exigirPermiso en el backend: el rol fijo nunca depende de una lista bien
  // poblada. `puede` es la única función que el resto del componente debe
  // usar para decidir qué mostrar; nadie compara `permisos.includes(...)` a
  // mano para no repetir el `rol === 'admin' ||` en cada sitio.
  const puede = useCallback((permiso: string) => rol === 'admin' || permisos.includes(permiso), [rol, permisos]);

  const [tabActiva, setTabActiva] = useState<TabSuperadmin>(() => {
    if (rol === 'admin' || permisos.includes('crear_usuario') || permisos.includes('editar_usuario') || permisos.includes('eliminar_usuario') || permisos.includes('impersonar_usuario')) {
      return 'usuarios';
    }
    if (permisos.includes('ver_metricas_ia')) return 'ia-tokens';
    if (permisos.includes('ver_facturacion')) return 'facturacion';
    if (permisos.includes('ver_visitantes')) return 'visitantes';
    if (permisos.includes('ver_auditoria')) return 'auditoria';
    return 'usuarios';
  });


  // Cada tema guarda su estado en su propio hook, pero todos viven aquí: así
  // cambiar de pestaña no borra una búsqueda ni un formulario a medio llenar.
  const usuariosAdmin = useUsuariosAdmin({ onIniciarAsesoria, onNavigateTo });
  const terminosAdmin = useTerminosAdmin(rol);
  const rolesAdmin = useRolesAdmin();
  const auditoriaAdmin = useAuditoriaAdmin();
  const metricasIAAdmin = useMetricasIAAdmin();
  const visitasAdmin = useVisitasAdmin();
  const rachaAdmin = useRachaAdmin();

  const { usuarios, setLoadingUsuarios, setUsuarioActualId, fetchUsuarios, isModalOpen, borrando, impersonando } = usuariosAdmin;
  const { cargarTerminos } = terminosAdmin;
  const { roles, fetchRoles, modalRolAbierto, borrandoRol } = rolesAdmin;
  const { fetchAuditoria } = auditoriaAdmin;
  const { metricasIA, fetchMetricasIA, consultaDetalle } = metricasIAAdmin;
  const { fetchVisitas, fetchVisitasHoy } = visitasAdmin;
  const { rachaDe, abrirRacha } = rachaAdmin;

  useBloqueoScroll(
    isModalOpen || borrando !== null || impersonando !== null || consultaDetalle !== null ||
    modalRolAbierto || borrandoRol !== null || rachaDe !== null,
  );

  // Estos efectos deciden CUÁNDO se piden los datos (al montar, al cambiar de
  // pestaña o de permisos). Las funciones que llaman se recrean en cada render;
  // ponerlas como dependencias volvería a pedir todo en cada render.
  useEffect(() => {
    const cliente = obtenerSupabase();
    void cliente?.auth.getUser().then(({ data }) => setUsuarioActualId(data.user?.id ?? null));
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Bajo RLS, un rol personalizado sin ninguno de los 4 permisos de gestión
    // de usuarios recibiría de todos modos su propia fila, no una lista
    // vacía silenciosa -- pero no tiene sentido pedirla si no puede hacer
    // nada con ella.
    if (puede('crear_usuario') || puede('editar_usuario') || puede('eliminar_usuario') || puede('impersonar_usuario')) {
      fetchUsuarios();
    } else {
      setLoadingUsuarios(false);
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [puede]);

  useEffect(() => {
    if (tabActiva === 'ia-tokens') fetchMetricasIA();
    if (tabActiva === 'auditoria') fetchAuditoria();
    if (tabActiva === 'visitantes') {
      fetchVisitas();
    }
    if (tabActiva === 'roles' || (tabActiva === 'usuarios' && rol === 'admin')) fetchRoles();
    if (tabActiva === 'legal') cargarTerminos();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActiva, fetchVisitas, fetchVisitasHoy, rol]);

  useEffect(() => {
    if (tabActiva !== 'visitantes') return;
    const interval = setInterval(() => {
      fetchVisitasHoy();
    }, 60000);
    return () => clearInterval(interval);
  }, [tabActiva, fetchVisitas, fetchVisitasHoy]);

  useEffect(() => {
    if (tabActiva !== 'ia-tokens') return;
    const actualizarAlVolver = () => {
      if (document.visibilityState === 'visible') void fetchMetricasIA();
    };
    const interval = setInterval(fetchMetricasIA, 5000);
    window.addEventListener('focus', actualizarAlVolver);
    document.addEventListener('visibilitychange', actualizarAlVolver);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', actualizarAlVolver);
      document.removeEventListener('visibilitychange', actualizarAlVolver);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActiva]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--fin-bg)] font-sans text-[var(--fin-ink)] transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--fin-line)] bg-[var(--fin-bg)]/80 px-4 py-3 backdrop-blur-xl transition-colors sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              aria-label="Volver"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-card)] hover:text-[var(--fin-ink)]"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h1 className="flex items-center gap-2 text-base font-bold tracking-tight">
                  Superadmin
                  {/* La versión que está corriendo ahora mismo. Aquí arriba
                      porque quien administra necesita saber contra qué versión
                      está mirando los números de abajo. */}
                  <span className="rounded-md bg-[var(--fin-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--fin-ink-soft)]">
                    {VERSION_ETIQUETA}
                  </span>
                </h1>
                <p className="text-[11px] text-[var(--fin-ink-soft)]">Usuarios, roles y analítica del ecosistema</p>
              </div>
            </div>
          </div>

          <TemaToggle tema={tema} onCambiar={onCambiarTema} />
        </div>

        {/* Navigation Tabs — cada una solo aparece si hay algo que ver dentro:
            la seguridad real vive en exigirPermiso del backend, esto es solo
            para no ofrecer una pestaña que va a devolver 403 en todo. */}
        <div className="mx-auto max-w-6xl mt-3 flex items-center gap-1.5 overflow-x-auto border-t border-[var(--fin-line)]/50 pt-2">
          {(puede('crear_usuario') || puede('editar_usuario') || puede('eliminar_usuario') || puede('impersonar_usuario')) && (
            <button
              onClick={() => setTabActiva('usuarios')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                tabActiva === 'usuarios'
                  ? 'bg-purple-600 text-white'
                  : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]'
              }`}
            >
              <Users className="h-4 w-4" />
              Usuarios ({usuarios.length})
            </button>
          )}

          {/* Gestionar el catálogo de roles no es un permiso delegable: si lo
              fuera, alguien con 'editar_usuario' podría crearse un rol con
              todo marcado y auto-asignárselo. Solo admin estricto. */}
          {rol === 'admin' && (
            <button
              onClick={() => setTabActiva('roles')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                tabActiva === 'roles'
                  ? 'bg-purple-600 text-white'
                  : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]'
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
              Roles
            </button>
          )}

          {rol === 'admin' && (
            <button
              onClick={() => setTabActiva('legal')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                tabActiva === 'legal'
                  ? 'bg-purple-600 text-white'
                  : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]'
              }`}
            >
              <FileText className="h-4 w-4" />
              Términos
            </button>
          )}

          {puede('ver_facturacion') && (
            <button
              onClick={() => setTabActiva('facturacion')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                tabActiva === 'facturacion'
                  ? 'bg-purple-600 text-white'
                  : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Planes
            </button>
          )}

          {puede('ver_metricas_ia') && (
            <button
              onClick={() => setTabActiva('ia-tokens')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                tabActiva === 'ia-tokens'
                  ? 'bg-purple-600 text-white'
                  : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]'
              }`}
            >
              <Cpu className="h-4 w-4" />
              IA & Tokens
              {metricasIA?.hayIA && (
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          )}

          {puede('ver_visitantes') && (
            <button
              onClick={() => setTabActiva('visitantes')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                tabActiva === 'visitantes'
                  ? 'bg-purple-600 text-white'
                  : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Analítica de tráfico
            </button>
          )}

          {puede('ver_auditoria') && (
            <button
              onClick={() => setTabActiva('auditoria')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                tabActiva === 'auditoria'
                  ? 'bg-purple-600 text-white'
                  : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]'
              }`}
            >
              <History className="h-4 w-4" />
              Auditoría
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:p-8">
        <div className="mx-auto max-w-6xl">
          {/* ========================================================================= */}
          {/* TAB 1: GESTIÓN DE USUARIOS */}
          {/* ========================================================================= */}
          {tabActiva === 'usuarios' && (
            <PestanaUsuarios u={usuariosAdmin} roles={roles} puede={puede} abrirRacha={abrirRacha} />
          )}

          {/* ========================================================================= */}
          {/* TAB ROLES: ROLES PERSONALIZADOS */}
          {/* ========================================================================= */}
          {tabActiva === 'roles' && (
            <PestanaRoles r={rolesAdmin} />
          )}

          {tabActiva === 'legal' && rol === 'admin' && (
            <PestanaTerminos t={terminosAdmin} />
          )}

          {/* ========================================================================= */}
          {/* TAB: PLANES Y FACTURACIÓN */}
          {/* ========================================================================= */}
          {tabActiva === 'facturacion' && <FacturacionPanel />}

          {/* ========================================================================= */}
          {/* TAB 2: MONITOR DE IA & TOKENS */}
          {/* ========================================================================= */}
          {tabActiva === 'ia-tokens' && (
            <PestanaIATokens m={metricasIAAdmin} rol={rol} />
          )}

          {/* ========================================================================= */}
          {/* TAB 3: ANALÍTICA DE VISITANTES */}
          {/* ========================================================================= */}
          {tabActiva === 'visitantes' && (
            <PestanaTrafico v={visitasAdmin} />
          )}

          {/* ========================================================================= */}
          {/* TAB 4: AUDITORÍA & SEGURIDAD */}
          {/* ========================================================================= */}
          {tabActiva === 'auditoria' && (
            <PestanaAuditoria a={auditoriaAdmin} />
          )}
        </div>
      </main>

      {/* ========================================================================= */}
      {/* MODALES: CREAR / EDITAR USUARIO */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <ModalUsuario u={usuariosAdmin} rol={rol} roles={roles} />
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREAR / EDITAR ROL PERSONALIZADO */}
      {/* ========================================================================= */}
      {modalRolAbierto && (
        <ModalRol r={rolesAdmin} />
      )}

      {/* ========================================================================= */}
      {/* MODAL: ELIMINAR ROL */}
      {/* ========================================================================= */}
      {borrandoRol && (
        <ModalEliminarRol r={rolesAdmin} borrandoRol={borrandoRol} />
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUMAR DÍAS DE RACHA */}
      {/* ========================================================================= */}
      {rachaDe && (
        <ModalRacha racha={rachaAdmin} rachaDe={rachaDe} />
      )}

      {/* ========================================================================= */}
      {/* MODAL: ELIMINAR USUARIO */}
      {/* ========================================================================= */}
      {borrando && (
        <ModalEliminarUsuario u={usuariosAdmin} borrando={borrando} />
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAR IMPERSONACIÓN / MODO ASESORÍA */}
      {/* ========================================================================= */}
      {impersonando && (
        <ModalAsesorar u={usuariosAdmin} impersonando={impersonando} />
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETALLE DE CONVERSACIÓN / HISTORIAL DEL CHAT DE LA PERSONA */}
      {/* ========================================================================= */}
      {consultaDetalle && (
        <ModalDetalleConsulta m={metricasIAAdmin} consultaDetalle={consultaDetalle} />
      )}
    </div>
  );
};
