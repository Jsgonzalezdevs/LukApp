// Kept out of LukAppShell.tsx so that file only exports a component — mixing
// constants with components breaks Fast Refresh, which oxlint flags via
// react/only-export-components.
import { BarChart3, Home, Menu, UserCircle, Wallet } from 'lucide-react';

/** Una navegación común en móvil y escritorio; las herramientas se abren en su sección. */
export const SECTIONS = [
  { id: 'inicio', icon: Home, label: 'Inicio' },
  { id: 'dinero', icon: Wallet, label: 'Dinero' },
  { id: 'mes', icon: BarChart3, label: 'Mes' },
  { id: 'asesor', icon: UserCircle, label: 'Asesor' },
  { id: 'ajustes', icon: Menu, label: 'Más' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'] | 'calendario';

export const sectionLabel = (section: SectionId): string =>
  section === 'calendario' ? 'Calendario financiero' : SECTIONS.find((s) => s.id === section)?.label ?? '';

/** Catálogo compartido por accesos, búsqueda y títulos; conserva los identificadores anteriores. */
export const PANELES_AJUSTES = [
  { id: 'forecast', label: 'Proyección financiera', ayuda: 'Mira cómo podría verse tu liquidez' },
  { id: 'categorias', label: 'Categorías', ayuda: 'Crea las tuyas o cambia las que hay' },
  { id: 'topes', label: 'Topes de gasto', ayuda: 'Te avisa antes de que te pases' },
  { id: 'periodo', label: 'Período', ayuda: 'Cada cuánto se reinicia lo que ves' },
  { id: 'metas', label: 'Metas de ahorro', ayuda: 'Ponte un objetivo y mira cuánto te falta' },
  { id: 'recurrentes', label: 'Pagos fijos', ayuda: 'Lo que te cobran todos los meses' },
  {
    id: 'compartido',
    label: 'Finanzas en Pareja / Compartidas',
    ayuda: 'Cuentas claras con tu pareja, viajes y gastos del hogar',
  },
  {
    id: 'dividir-cuenta',
    label: 'Dividir cuenta y propina',
    ayuda: 'Calcula cuánto le toca a cada uno en salidas y anota tu parte',
  },
  {
    id: 'vaquitas',
    label: 'Vaquitas y Gastos Compartidos',
    ayuda: 'Arma vacas para paseos, asados o salidas y salda deudas',
  },
  { id: 'extractos', label: 'Importar extractos', ayuda: 'Sube el PDF que te manda el banco' },
  { id: 'atajos', label: 'Registro automático', ayuda: 'Que Apple Pay anote el gasto solo' },
  { id: 'gmf', label: 'Impuesto 4x1000', ayuda: 'Cuánto te está costando y en qué cuenta' },
  {
    id: 'nombres',
    label: 'Nombres repetidos',
    ayuda: 'Une a la misma persona escrita de dos formas',
  },
  { id: 'contraseña', label: 'Cambiar contraseña', ayuda: 'Cambia tu contraseña o recupérala' },
  { id: 'respaldo', label: 'Copia de seguridad', ayuda: 'Descarga todo, o vuelve a un respaldo' },
  {
    id: 'funciones-solicitadas',
    label: 'Funciones solicitadas',
    ayuda: 'Propón una idea y vota las de los demás',
  },
  { id: 'cuenta', label: 'Cuenta', ayuda: 'Tu perfil, sincronización y borrar la cuenta' },
] as const;

export type PanelAjustes = (typeof PANELES_AJUSTES)[number]['id'];
