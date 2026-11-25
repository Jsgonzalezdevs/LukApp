import { describe, expect, it } from 'vitest';
import { CONTEXTO_PRODUCTO_LUKAPP, responderAyudaLukApp } from './contextoProductoIA.ts';

describe('responderAyudaLukApp', () => {
  it('deja que el Asesor prepare una propuesta cuando la persona da una instrucción', () => {
    expect(responderAyudaLukApp('Quiero poner un presupuesto de 300 mil para comida')).toBeNull();
  });

  it('explica dónde están los topes cuando la pregunta es de navegación', () => {
    expect(responderAyudaLukApp('¿Dónde veo los topes?')).toContain('sección **Mes**');
  });

  it('deja que el motor financiero revise las suscripciones registradas', () => {
    expect(responderAyudaLukApp('Mis suscripciones')).toBeNull();
  });

  it('explica dónde revisar pagos fijos cuando la pregunta es de navegación', () => {
    expect(responderAyudaLukApp('¿Dónde puedo administrar los pagos fijos?')).toContain('**Pagos fijos**');
  });

  it('responde sin tecnicismos cómo cambiar el nombre de usuario', () => {
    const respuesta = responderAyudaLukApp('Como puedo cambiar mi nombre de usuario?');
    expect(respuesta).toContain('Cambiar nombre');
    expect(respuesta).not.toMatch(/supabase|servidor|base de datos/i);
  });

  it('no confunde el nombre de usuario con el de una cuenta o categoría', () => {
    expect(responderAyudaLukApp('Quiero cambiar el nombre de una categoría')).not.toContain('apodo');
    expect(responderAyudaLukApp('Cómo cambio el nombre de la cajita')).toBeNull();
  });
});

describe('CONTEXTO_PRODUCTO_LUKAPP', () => {
  it('no le cuenta al Asesor cómo está construida la app por dentro', () => {
    expect(CONTEXTO_PRODUCTO_LUKAPP).not.toMatch(/supabase|server\.ts|react|typescript|migrations|api\b/i);
  });
});

describe('actualizar saldos', () => {
  it('explica cómo editar el saldo en vez de mandar a importar extractos', () => {
    const respuesta = responderAyudaLukApp('ayudame a actualizazr mis saldos');
    expect(respuesta).toContain('Saldo actual');
    expect(respuesta).not.toContain('Importar');
  });
});
