import { describe, expect, it } from 'vitest';
import { continuarDeuda, leerMontoConversacion } from './conversacionDeuda';
import { responderAsesor, detectarMovimiento, type AsesorContext } from './asesorBot';
import { LEXICO_VACIO } from './aprendizaje';
import type { Cajita } from '../data/modelos';

describe('conversación guiada de deuda', () => {
  const cajita: Cajita = { id: 'mac', nombre: 'MacBook Air M5', tipo: 'cajita', icon: 'Wallet', metaCop: 5000000, tasaEaPct: null, archivedAt: null, createdAt: '' };
  it('usa el saldo de la cajita indicada sin confundir M5 con un monto', () => {
    const r = responderAsesor('Lo que tengo de ahorro en la cajita de la MacBook Air M5', [], [cajita], { mac: 1500000 }, [], LEXICO_VACIO, {
      ultimoAsunto: null, ultimaFecha: null, conversacionDeuda: { deuda: 900000, pendiente: 'ahorros' },
    });
    expect(r.newContext.conversacionDeuda).toMatchObject({ ahorros: 1500000, pendiente: 'reserva' });
    expect(r.text).toContain('MacBook Air M5');
    expect(r.action).toBeUndefined();
  });
  it('distingue saldo cero, saldo ausente y nombres duplicados', () => {
    const estado = { deuda: 900000, pendiente: 'ahorros' as const };
    const pregunta = 'Mi ahorro en la cajita MacBook Air M5';
    expect(continuarDeuda(pregunta, estado, [cajita], { mac: 0 }).estado?.ahorros).toBe(0);
    expect(continuarDeuda(pregunta, estado, [cajita], {}).estado?.ahorros).toBeUndefined();
    expect(continuarDeuda(pregunta, estado, [cajita, { ...cajita, id: 'otra' }], { mac: 500 }).respuesta).toContain('varias cajitas');
    expect(continuarDeuda(pregunta, estado, [{ ...cajita, archivedAt: '2026-01-01' }], { mac: 500 }).estado?.ahorros).toBeUndefined();
  });
  it.each(['No perdón, eran 900.000', 'Perdón, son 900 mil', 'Eran 900000', 'Corrijo: 900000', 'Me equivoqué, eran 900000'])('corrige el dato anterior sin responder la pregunta siguiente: %s', texto => {
    const inicial = continuarDeuda('90000', { pendiente: 'deuda' });
    const r = continuarDeuda(texto, inicial.estado);
    expect(r.estado?.deuda).toBe(900000);
    expect(r.estado?.ahorros).toBeUndefined();
    expect(r.estado?.pendiente).toBe('ahorros');
    expect(r.respuesta).toContain('corregí');
  });
  it('corrige ahorros y reserva, pero un monto simple responde la pregunta pendiente', () => {
    const deuda = continuarDeuda('900000', { pendiente: 'deuda' });
    const ahorros = continuarDeuda('1000000', deuda.estado);
    const corregido = continuarDeuda('No perdón, eran 2000000', ahorros.estado);
    expect(corregido.estado).toMatchObject({ deuda: 900000, ahorros: 2000000, pendiente: 'reserva' });
    const reserva = continuarDeuda('500000', corregido.estado);
    expect(continuarDeuda('Eran 700000', reserva.estado).estado?.reserva).toBe(700000);
  });
  it('no adivina qué corregir cuando no hay un dato anterior', () => {
    const r = continuarDeuda('No perdón, eran 900000', { pendiente: 'deuda' });
    expect(r.estado?.deuda).toBeUndefined();
  });
  it.each(['El saldo total es 900000', 'Mi deuda es 900 mil pesos.', 'El saldo pendiente es $900.000', 'Son 900000', 'En total son 900 mil'])('acepta una respuesta natural: %s', texto => {
    const r = continuarDeuda(texto, { pendiente: 'deuda', ingresosInciertos: true });
    expect(r.estado?.deuda).toBe(900000);
    expect(r.estado?.pendiente).toBe('ahorros');
    expect(r.respuesta).not.toContain('Cuál es el saldo total');
    expect(r.respuesta).not.toContain('situación laboral');
  });
  it('avanza con ahorros y reserva expresados en frases', () => {
    const ahorro = continuarDeuda('Tengo ahorrado 1,5 millones', { deuda: 900000, pendiente: 'ahorros' });
    expect(ahorro.estado?.ahorros).toBe(1500000);
    const reserva = continuarDeuda('Necesito conservar 500 mil pesos.', ahorro.estado);
    expect(reserva.estado?.reserva).toBe(500000);
    expect(reserva.estado?.pendiente).toBeUndefined();
  });
  it.each(['La cuota es 70000', 'No sé, entre 500000 y 900000', 'La tasa es 2%', 'No debo 900000'])('no sustituye el saldo con datos ambiguos: %s', texto => {
    const r = continuarDeuda(texto, { pendiente: 'deuda' });
    expect(r.estado?.deuda).toBeUndefined();
    expect(r.respuesta).toContain('No pude identificar');
  });
  it.each([['70000', 70000], ['$700.000', 700000], ['1,5 millones', 1500000], ['70 mil', 70000], ['0', 0]])('interpreta %s', (texto, esperado) => {
    expect(leerMontoConversacion(String(texto))).toBe(esperado);
  });
  it.each(['enero 2027', '2% mensual', '70000 y 50000', '-50', '1.5', 'no sé'])('no inventa un monto con %s', texto => {
    expect(leerMontoConversacion(texto)).toBeNull();
  });
  it('recuerda tres turnos, compara y permite corregir sin registrar', () => {
    let contexto: AsesorContext = { ultimoAsunto: null, ultimaFecha: null };
    const enviar = (texto: string) => {
      expect(detectarMovimiento(texto, [], [], [], LEXICO_VACIO, contexto).propuesta).toBeNull();
      const r = responderAsesor(texto, [], [], {}, [], LEXICO_VACIO, contexto);
      contexto = r.newContext;
      expect(r.action).toBeUndefined();
      expect(r.actions).toBeUndefined();
      return r;
    };
    enviar('Me recomiendas pagar mi deuda con ahorros, mi contrato termina en enero');
    expect(enviar('700 mil').newContext.conversacionDeuda?.pendiente).toBe('ahorros');
    expect(enviar('1 millón').newContext.conversacionDeuda?.pendiente).toBe('reserva');
    const comparacion = enviar('500 mil');
    expect(comparacion.text).toContain('$200.000');
    expect(comparacion.text).toContain('por debajo de la reserva');
    expect(contexto.conversacionDeuda?.ingresosInciertos).toBe(true);
    expect(enviar('reserva: 800 mil').text).toContain('$800.000');
    enviar('Cancelar');
    expect(contexto.conversacionDeuda).toBeUndefined();
    expect(responderAsesor('Pagué 70 mil en comida', [], [], {}, [], LEXICO_VACIO, contexto).action?.amount).toBe(70000);
  });
  it('acepta datos etiquetados juntos y no ofrece usar una reserva inexistente', () => {
    const r = continuarDeuda('deuda: 700 mil; ahorros: 200 mil; reserva: 500 mil');
    expect(r.estado).toMatchObject({ deuda: 700000, ahorros: 200000, reserva: 500000 });
    expect(r.respuesta).toContain('máximo **$0**');
    expect(r.respuesta).toContain('supera tus ahorros');
  });
  it('no trata cuotas ambiguas como saldo total y permite cambiar a un gasto', () => {
    const r = continuarDeuda('Mi deuda tiene una cuota de 70000');
    expect(r.estado?.deuda).toBeUndefined();
    const siguiente = continuarDeuda('Pagué 70000 en comida', r.estado);
    expect(siguiente.estado).toBeUndefined();
    expect(siguiente.respuesta).toBeNull();
  });
  it.each(['No pagué 70000', 'Mi sueldo es 1500000', 'Tengo ahorrado 200000', 'No registres 70000 en comida'])('no propone registrar %s', texto => {
    expect(detectarMovimiento(texto, [], [], [], LEXICO_VACIO, { ultimoAsunto: null, ultimaFecha: null }).propuesta).toBeNull();
  });
});
