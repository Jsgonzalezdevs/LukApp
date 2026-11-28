// @vitest-environment jsdom
/**
 * Recorre el panel de superadmin como lo haría quien lo administra: cada
 * pestaña, cada modal y los formularios con error y con envío. Sirve de red
 * para cambiar su estructura sin cambiar lo que se ve ni lo que se manda a la
 * API: con VOLCADO_SUPERADMIN=<carpeta> además escribe el HTML de cada paso y
 * las llamadas hechas, para comparar dos versiones del panel byte por byte.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clienteFalso = {
  auth: {
    getSession: async () => ({
      data: { session: { access_token: 'token-admin', refresh_token: 'refresco', user: { email: 'admin@lukapp.co', user_metadata: { usuario: 'Admin' } } } },
    }),
    getUser: async () => ({ data: { user: { id: 'u-yo' } } }),
    verifyOtp: async () => ({ error: null }),
  },
};
vi.mock('../features/lukapp/data/supabase', () => ({ obtenerSupabase: () => clienteFalso }));

import { SuperadminPanel } from './SuperadminPanel';

const USUARIOS = [
  { id: 'u-yo', email: 'admin@lukapp.co', usuario: 'Admin', rol: 'admin', rol_personalizado_id: null, created_at: '2026-01-10T12:00:00Z', ultimo_acceso_at: '2026-11-26T20:15:00Z' },
  { id: 'u-ana', email: 'ana@correo.co', usuario: 'Ana', rol: 'usuario', rol_personalizado_id: 'r-soporte', created_at: '2026-03-02T12:00:00Z', ultimo_acceso_at: null },
  { id: 'u-beto', email: 'beto@correo.co', usuario: null, rol: 'usuario', rol_personalizado_id: null, created_at: '2026-05-20T12:00:00Z', ultimo_acceso_at: '2026-11-20T09:00:00Z' },
];
const ROLES = {
  roles: [
    { id: 'r-soporte', nombre: 'Soporte', descripcion: 'Atiende cuentas', permisos: ['editar_usuario', 'ver_metricas_ia'] },
    { id: 'r-vacio', nombre: 'Observador', descripcion: null, permisos: [] },
  ],
  catalogoPermisos: [
    { clave: 'crear_usuario', descripcion: 'Crear usuarios' },
    { clave: 'editar_usuario', descripcion: 'Editar usuarios' },
    { clave: 'ver_metricas_ia', descripcion: 'Ver métricas de IA' },
  ],
};
const METRICAS = {
  fecha: '2026-11-27', proveedor: 'Groq Cloud', modelo: 'openai/gpt-oss-20b', hayIA: true,
  tokensHoy: 7356, limiteTokensDiariosReferencia: 200000, llamadasHoy: 2, llamadasExitosas: 1, llamadasFallback: 1,
  limiteTokensProveedorMinuto: 8000, tokensProveedorRestantesMinuto: 680, limiteSolicitudesProveedorDia: 1000,
  solicitudesProveedorRestantesDia: 999, porcentajeCapacidadTokens: 91.5, cuotaProveedorObservadaEn: '2026-11-27T12:31:51Z',
  latenciaPromedioMs: 1840, costoEstimadoCop: 0, origenMetricas: 'supabase', diagnosticoTelemetria: null,
  consumoPorUsuario: [{ usuarioEmail: 'ana@correo.co', consultas: 2, exitosas: 1, locales: 1, tokens: 7356 }],
  peticionesRecientes: [
    { id: 'p1', timestamp: '2026-11-27T12:31:51Z', usuarioEmail: 'ana@correo.co', proveedor: 'Groq', modelo: 'openai/gpt-oss-20b', promptTokens: 6936, completionTokens: 420, totalTokens: 7356, duracionMs: 1840, exito: true, promptText: '¿Cómo voy este mes?', respuestaTexto: JSON.stringify([{ id: 'a', titulo: 'Vas bien', detalle: 'Gastaste menos que en octubre.', tono: 'bien' }]) },
    { id: 'p2', timestamp: '2026-11-27T13:00:00Z', usuarioEmail: 'ana@correo.co', proveedor: 'Ninguno', modelo: 'local', promptTokens: 30, completionTokens: 0, totalTokens: 30, duracionMs: 12000, exito: false, motivo: 'groq:429', promptText: 'hola' },
  ],
};
const VISITAS = {
  visitas: [
    { creado_en: '2026-11-26T15:00:00Z', ruta: '/', pais: 'CO', dispositivo: 'movil', fuente: 'google.com', visitante: 'v1' },
    { creado_en: '2026-11-26T16:30:00Z', ruta: '/finanzas', pais: 'CO', dispositivo: 'escritorio', fuente: 'directo', visitante: 'v2' },
    { creado_en: '2026-11-25T02:00:00Z', ruta: '/', pais: 'MX', dispositivo: 'tablet', fuente: 'instagram.com', visitante: 'v3' },
  ],
  hoy: { fecha: '2026-11-27', visitas_hoy: 14, unicos_hoy: 9 },
};
const LOGS = { logs: [{ id: 'l1', timestamp: '2026-11-26T18:00:00Z', adminEmail: 'admin@lukapp.co', action: 'Editó usuario', targetUser: 'ana@correo.co', details: 'Cambió el rol' }] };
const RACHA = { rachaActual: 12, rachaMaxima: 30, diasRegalados: 3, anotadoHoy: false };

type Llamada = { metodo: string; ruta: string; cuerpo: unknown };
let llamadas: Llamada[] = [];

const responder = (datos: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } }));

const fetchFalso = vi.fn((entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(entrada), 'http://localhost');
  const metodo = (init?.method ?? 'GET').toUpperCase();
  const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
  llamadas.push({ metodo, ruta: `${url.pathname}${url.search}`, cuerpo });
  const r = url.pathname;
  if (r === '/api/superadmin/usuarios') return responder({ usuarios: USUARIOS });
  if (r === '/api/roles') return responder(ROLES);
  if (r === '/api/metricas-ia') return responder(METRICAS);
  if (r === '/api/superadmin/visitas') return responder(VISITAS);
  if (r === '/api/auditoria-logs') return responder(LOGS);
  if (r === '/api/superadmin/legal/terminos' && metodo === 'GET') return responder({ contenido: 'Términos vigentes de prueba.', actualizadoEn: '2026-10-01T15:00:00Z' });
  if (r === '/api/superadmin/legal/terminos') return responder({ contenido: cuerpo?.contenido, actualizadoEn: '2026-11-27T15:00:00Z' });
  if (r === '/api/superadmin/racha') return responder(metodo === 'GET' ? RACHA : { ...RACHA, rachaActual: 12 + Number(cuerpo?.dias ?? 0) });
  if (r === '/api/superadmin/ia/conocimiento') return responder({ documentos: [] });
  if (r === '/api/superadmin/facturacion') return responder({
    planes: [],
    resumen: { premiumActivas: 1, mensuales: 1, anuales: 0, cortesia: 0, estimadoMensualCop: 14900 },
    puedeAdministrar: true,
    pasarela: { codigo: 'wompi', habilitada: false, ambiente: null },
    suscripciones: [],
    usuarios: [],
  });
  if (r === '/api/crear-usuario') return responder({ error: 'Ese correo ya existe' }, 409);
  if (r === '/api/editar-usuario' || r === '/api/crear-rol' || r === '/api/editar-rol' || r === '/api/eliminar-rol' || r === '/api/eliminar-usuario') return responder({ ok: true });
  return responder({});
});

const DIRECTORIO = process.env.VOLCADO_SUPERADMIN;
let paso = 0;
const volcar = (nombre: string, contenedor: HTMLElement) => {
  paso += 1;
  if (!DIRECTORIO) return;
  mkdirSync(DIRECTORIO, { recursive: true });
  writeFileSync(path.join(DIRECTORIO, `${String(paso).padStart(2, '0')}-${nombre}.html`), contenedor.innerHTML.replace(/></g, '>\n<'));
};
const volcarLlamadas = (nombre: string) => {
  if (!DIRECTORIO) return;
  writeFileSync(path.join(DIRECTORIO, `llamadas-${nombre}.json`), JSON.stringify(llamadas, null, 1));
};

const pestana = (nombre: RegExp) => {
  const nav = document.querySelector('header')!;
  fireEvent.click(within(nav).getByRole('button', { name: nombre }));
};
const props = { onBack: vi.fn(), tema: 'claro' as const, onCambiarTema: vi.fn() };

beforeEach(() => {
  llamadas = [];
  paso = 0;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-27T15:00:00Z'));
  vi.stubGlobal('fetch', fetchFalso);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('SuperadminPanel', () => {
  it('admin: usuarios, roles, términos, planes, IA, tráfico y auditoría', async () => {
    const { container } = render(<SuperadminPanel rol="admin" permisos={[]} {...props} />);
    await screen.findByText('ana@correo.co');
    await screen.findByText('Soporte', { selector: 'span' });
    expect(screen.getByRole('button', { name: /Usuarios \(3\)/ })).toBeTruthy();
    volcar('usuarios', container);

    fireEvent.change(screen.getByPlaceholderText('Buscar por correo o usuario...'), { target: { value: 'beto' } });
    expect(screen.queryByText('ana@correo.co')).toBeNull();
    expect(screen.getByText('Exportar a Excel (1)')).toBeTruthy();
    volcar('busqueda', container);
    fireEvent.change(screen.getByPlaceholderText('Buscar por correo o usuario...'), { target: { value: '' } });

    // Crear: contraseña débil, luego una válida que el servidor rechaza.
    fireEvent.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
    expect(screen.getByText('Crear Nuevo Usuario')).toBeTruthy();
    volcar('modal-crear', container);
    const modalCrear = screen.getByText('Crear Nuevo Usuario').closest('div.relative') as HTMLElement;
    fireEvent.change(modalCrear.querySelector('input[type="email"]')!, { target: { value: 'nuevo@correo.co' } });
    fireEvent.change(modalCrear.querySelector('input[type="password"]')!, { target: { value: 'debil' } });
    fireEvent.click(within(modalCrear).getByRole('button', { name: 'Crear' }));
    await waitFor(() => expect(modalCrear.querySelector('.text-red-600')).toBeTruthy());
    volcar('crear-debil', container);
    fireEvent.change(modalCrear.querySelector('input[type="password"]')!, { target: { value: 'Segura#2026' } });
    fireEvent.click(within(modalCrear).getByRole('button', { name: 'Crear' }));
    await screen.findByText('Ese correo ya existe');
    volcar('crear-rechazado', container);
    fireEvent.click(within(modalCrear).getByRole('button', { name: 'Cancelar' }));

    // Editar a otra persona y guardar; editar la propia cuenta.
    const filaAna = screen.getByText('ana@correo.co').closest('tr')!;
    fireEvent.click(within(filaAna).getByTitle('Editar usuario'));
    expect(screen.getByText('Editar Usuario')).toBeTruthy();
    volcar('modal-editar', container);
    const modalEditar = screen.getByText('Editar Usuario').closest('div.relative') as HTMLElement;
    fireEvent.change(modalEditar.querySelector('input[type="text"]')!, { target: { value: 'Ana María' } });
    fireEvent.click(within(modalEditar).getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(screen.queryByText('Editar Usuario')).toBeNull());

    await waitFor(() => expect(screen.getByText('admin@lukapp.co').closest('tr')).toBeTruthy());
    fireEvent.click(within(screen.getByText('admin@lukapp.co').closest('tr')!).getByTitle('Editar usuario'));
    await screen.findByText(/Esta es tu propia cuenta/);
    volcar('modal-editar-propia', container);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    // Eliminar, asesorar y racha.
    fireEvent.click(within(screen.getByText('beto@correo.co').closest('tr')!).getByTitle('Eliminar usuario'));
    expect(screen.getByText('Eliminar Usuario')).toBeTruthy();
    volcar('modal-eliminar', container);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(screen.queryByText('Eliminar Usuario')).toBeNull());

    fireEvent.click(within(screen.getByText('ana@correo.co').closest('tr')!).getByTitle(/Ver finanzas como/));
    expect(screen.getByText('Iniciar Modo Asesoría')).toBeTruthy();
    volcar('modal-asesorar', container);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    fireEvent.click(screen.getByRole('button', { name: /Sumar días de racha a Ana/ }));
    await screen.findByText('12');
    volcar('modal-racha', container);
    fireEvent.change(screen.getByLabelText('Días a sumar'), { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sumar días' }));
    await screen.findByText('Escribe cuántos días sumar, de 1 a 365.');
    fireEvent.change(screen.getByLabelText('Días a sumar'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sumar días' }));
    await screen.findByText('17');
    volcar('racha-sumada', container);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    // Roles.
    pestana(/^Roles$/);
    await screen.findByText('Atiende cuentas');
    volcar('roles', container);
    fireEvent.click(screen.getByRole('button', { name: /Nuevo Rol/ }));
    const modalRol = screen.getByText('Nuevo Rol', { selector: 'h3' }).closest('div.relative') as HTMLElement;
    fireEvent.change(within(modalRol).getByPlaceholderText('Ej: Supervisor'), { target: { value: 'Analista' } });
    fireEvent.click(within(modalRol).getByLabelText('Ver métricas de IA'));
    volcar('modal-nuevo-rol', container);
    fireEvent.click(within(modalRol).getByRole('button', { name: 'Crear' }));
    await waitFor(() => expect(screen.queryByText('Nuevo Rol', { selector: 'h3' })).toBeNull());
    fireEvent.click(screen.getAllByTitle('Editar rol')[0]);
    expect(screen.getByText('Editar Rol')).toBeTruthy();
    volcar('modal-editar-rol', container);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getAllByTitle('Eliminar rol')[1]);
    volcar('modal-eliminar-rol', container);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(screen.queryByText('Eliminar Rol')).toBeNull());

    // Términos.
    pestana(/^Términos$/);
    await waitFor(() => expect((screen.getByLabelText('Contenido publicado') as HTMLTextAreaElement).value).toBe('Términos vigentes de prueba.'));
    volcar('terminos', container);
    fireEvent.change(screen.getByLabelText('Contenido publicado'), { target: { value: 'Nuevos términos.' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar y publicar/ }));
    await screen.findByText('Los términos y condiciones ya están publicados.');
    volcar('terminos-publicados', container);

    // Planes.
    pestana(/^Planes$/);
    await act(async () => { await Promise.resolve(); });
    volcar('planes', container);

    // IA & Tokens y el detalle de una consulta.
    pestana(/IA & Tokens/);
    await screen.findByText('Groq Cloud');
    await waitFor(() => expect(llamadas.some((l) => l.ruta === '/api/superadmin/ia/conocimiento')).toBe(true));
    await act(async () => { await Promise.resolve(); });
    volcar('ia-tokens', container);
    fireEvent.click(screen.getAllByRole('button', { name: /Chat/ })[0]);
    await screen.findByText('Vas bien');
    volcar('detalle-consulta', container);
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar' }).at(-1)!);
    fireEvent.click(screen.getAllByRole('button', { name: /Chat/ })[1]);
    await screen.findByText(/Motor Local \(groq:429\)/);
    volcar('detalle-consulta-local', container);
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar' }).at(-1)!);

    // Tráfico y cambio de rango.
    pestana(/Analítica de tráfico/);
    await screen.findByText('Visitas de hoy');
    volcar('trafico', container);
    fireEvent.click(screen.getByRole('button', { name: '7 días' }));
    await waitFor(() => expect(llamadas.some((l) => l.ruta === '/api/superadmin/visitas?dias=7')).toBe(true));
    await screen.findByText('Visitas de hoy');
    volcar('trafico-7-dias', container);

    // Auditoría.
    pestana(/Auditoría/);
    await screen.findByText('Editó usuario');
    volcar('auditoria', container);

    volcarLlamadas('admin');
  });

  it('rol personalizado: solo ve las pestañas de sus permisos', async () => {
    const { container } = render(<SuperadminPanel rol="usuario" permisos={['ver_metricas_ia', 'ver_visitantes']} {...props} />);
    await screen.findByText('Groq Cloud');
    expect(screen.queryByRole('button', { name: /Usuarios/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Roles$/ })).toBeNull();
    expect(screen.queryByText('Conocimiento de LukApp para la IA')).toBeNull();
    volcar('personalizado-inicio', container);
    volcarLlamadas('personalizado');
  });
});
