import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gestoPerteneceAOtroScroll, usePullToRefresh } from './usePullToRefresh';

const tocar = (tipo: 'touchstart' | 'touchmove' | 'touchend', objetivo: Element, y: number) => {
  const evento = new Event(tipo, { bubbles: true, cancelable: true }) as TouchEvent;
  Object.defineProperty(evento, 'touches', { value: tipo === 'touchend' ? [] : [{ clientX: 100, clientY: y }] });
  objetivo.dispatchEvent(evento);
  return evento;
};

afterEach(() => {
  document.body.innerHTML = '';
  document.body.removeAttribute('style');
});

describe('usePullToRefresh', () => {
  it('jala para refrescar cuando el arrastre empieza en la página, en el tope', () => {
    const contenido = document.createElement('p');
    document.body.appendChild(contenido);
    const { result } = renderHook(() => usePullToRefresh(vi.fn(), true));

    act(() => { tocar('touchstart', contenido, 100); });
    let movimiento!: TouchEvent;
    act(() => { movimiento = tocar('touchmove', contenido, 220); });

    expect(movimiento.defaultPrevented).toBe(true);
    expect(result.current.desplazamiento).toBeGreaterThan(0);
  });

  it('no se roba el arrastre dentro de una hoja abierta: deja volver a subir en Premium', () => {
    // Así deja useBloqueoScroll el body mientras la invitación está abierta.
    document.body.style.position = 'fixed';
    const dialogo = document.createElement('div');
    dialogo.setAttribute('role', 'dialog');
    const lista = document.createElement('div');
    dialogo.appendChild(lista);
    document.body.appendChild(dialogo);
    const { result } = renderHook(() => usePullToRefresh(vi.fn(), true));

    act(() => { tocar('touchstart', lista, 100); });
    let movimiento!: TouchEvent;
    act(() => { movimiento = tocar('touchmove', lista, 260); });

    expect(movimiento.defaultPrevented).toBe(false);
    expect(result.current.desplazamiento).toBe(0);
  });
});

describe('gestoPerteneceAOtroScroll', () => {
  it('reconoce un contenedor con scroll propio que no está en su tope', () => {
    const caja = document.createElement('div');
    caja.style.overflowY = 'auto';
    const hijo = document.createElement('span');
    caja.appendChild(hijo);
    document.body.appendChild(caja);
    Object.defineProperty(caja, 'scrollHeight', { value: 900 });
    Object.defineProperty(caja, 'clientHeight', { value: 300 });

    caja.scrollTop = 0;
    expect(gestoPerteneceAOtroScroll(hijo)).toBe(false);
    caja.scrollTop = 120;
    expect(gestoPerteneceAOtroScroll(hijo)).toBe(true);
  });
});
