import { describe, expect, it } from 'vitest';
import { responderAyudaLukApp } from './contextoProductoIA.ts';

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
});
