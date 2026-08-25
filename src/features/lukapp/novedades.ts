/**
 * El historial de "qué cambió", más reciente primero.
 *
 * Es un archivo que se edita a mano con cada lanzamiento que valga la pena
 * contar -- no todo commit, solo lo que un usuario notaría o le sirve saber.
 * `VERSION_ACTUAL` sale sola de la primera entrada: agregar una entrada nueva
 * arriba de la lista es lo único que hace falta para que la tarjeta de
 * novedades vuelva a aparecer.
 */
export interface Novedad {
  /** Un identificador único, no tiene que ser semver estricto. */
  version: string;
  /** Solo de referencia interna -- no se le enseña al usuario. */
  fecha: string;
  texto: string;
}

export const NOVEDADES: readonly Novedad[] = [
  {
    version: '1.1.0',
    fecha: '2026-08-25',
    texto:
      'Presupuestos ahora muestra todas tus categorías, no solo las que ya tienen tope, y te sugiere un monto según lo que sueles gastar. Elige cada cuánto se reinicia todo — semanal, cada dos semanas, varias veces al mes, mensual o sin reinicio — desde Ajustes → Período. Además: la pantalla de Cuenta con tu ID y estado de sincronización, funciones solicitadas por votación, y un menú de Ajustes más fácil de reconocer de un vistazo.',
  },
];

export const VERSION_ACTUAL: string = NOVEDADES[0]?.version ?? '1.0.0';
