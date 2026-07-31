// Spanish-only, deliberately NOT wired into LanguageContext: that interface is
// a Record<Language, Translations>, so adding a key here would force writing
// English copy for a private tool and make the shared type a chokepoint that can
// break the portfolio's type-check.
export const COPY = {
  appName: 'Finanzas',

  balance: {
    balance: 'Balance',
    ingresos: 'Ingresos',
    gastos: 'Gastos',
  },

  input: {
    placeholder: 'Ej: gasté 20 mil en el almuerzo',
    submit: 'Registrar',
    listening: 'Escuchando…',
    speak: 'Dictar',
    stop: 'Detener',
    keyboardHint: 'Toca el campo y usa la tecla 🎤 del teclado para dictar.',
    blocked: 'El dictado de un toque no funciona con la app instalada. Usa la tecla 🎤 del teclado.',
    offline: 'El dictado de un toque necesita internet. La tecla 🎤 del teclado funciona sin conexión.',
  },

  confirm: {
    title: 'Confirmar',
    review: 'Revisa lo resaltado',
    amount: 'Monto',
    kind: 'Tipo',
    gasto: 'Gasto',
    ingreso: 'Ingreso',
    category: 'Categoría',
    description: 'Descripción',
    heard: 'Escuché',
    save: 'Guardar',
    cancel: 'Cancelar',
    amountMissing: 'No entendí el monto',
  },

  list: {
    empty: 'Aún no hay movimientos.',
    emptyHint: 'Dicta o escribe tu primer gasto arriba.',
    delete: 'Eliminar',
  },
} as const;
