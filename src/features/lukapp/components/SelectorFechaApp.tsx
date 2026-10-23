import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  id?: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  className?: string;
  'aria-label'?: string;
};

const fechaIso = (fecha: Date) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
const desdeIso = (valor: string) => {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!coincidencia) return null;
  const fecha = new Date(Number(coincidencia[1]), Number(coincidencia[2]) - 1, Number(coincidencia[3]));
  return fechaIso(fecha) === valor ? fecha : null;
};
const igualMes = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const sumarMes = (fecha: Date, cantidad: number) => new Date(fecha.getFullYear(), fecha.getMonth() + cantidad, 1);
const formatoLargo = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const formatoMes = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });

const hoyLocal = () => {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
};

export const SelectorFechaApp: React.FC<Props> = ({
  id,
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  name,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const idGenerado = useId();
  const idMenu = `calendario-${id ?? idGenerado}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fechaElegida = desdeIso(value);
  const hoy = useMemo(hoyLocal, []);
  const minDate = desdeIso(min ?? '');
  const maxDate = desdeIso(max ?? '');
  const mesInicial = fechaElegida ?? hoy;
  const [abierto, setAbierto] = useState(false);
  const [mesVisible, setMesVisible] = useState(() => new Date(mesInicial.getFullYear(), mesInicial.getMonth(), 1));
  const [fechaActiva, setFechaActiva] = useState(() => fechaIso(mesInicial));
  const [posicion, setPosicion] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const dias = useMemo(() => {
    const primero = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);
    const desplazamientoLunes = (primero.getDay() + 6) % 7;
    const inicio = new Date(primero.getFullYear(), primero.getMonth(), 1 - desplazamientoLunes);
    return Array.from({ length: 42 }, (_, indice) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + indice));
  }, [mesVisible]);

  const actualizarPosicion = () => {
    const caja = inputRef.current?.getBoundingClientRect();
    if (!caja) return;
    const margen = 12;
    const ancho = Math.min(360, window.innerWidth - margen * 2);
    const altoDeseado = Math.min(430, window.innerHeight - margen * 2);
    const abajo = window.innerHeight - caja.bottom - margen;
    const arriba = caja.top - margen;
    const abrirArriba = abajo < Math.min(330, altoDeseado) && arriba > abajo;
    const alto = Math.min(altoDeseado, abrirArriba ? arriba : abajo);
    setPosicion({
      left: Math.max(margen, Math.min(caja.left, window.innerWidth - ancho - margen)),
      top: abrirArriba ? Math.max(margen, caja.top - alto - 8) : caja.bottom + 8,
      width: ancho,
      maxHeight: alto,
    });
  };

  useEffect(() => {
    if (!abierto) return;
    actualizarPosicion();
    const cerrarFuera = (evento: PointerEvent) => {
      const destino = evento.target as Node;
      if (!inputRef.current?.contains(destino) && !botonRef.current?.contains(destino) && !menuRef.current?.contains(destino)) setAbierto(false);
    };
    const recolocar = () => actualizarPosicion();
    document.addEventListener('pointerdown', cerrarFuera);
    window.addEventListener('resize', recolocar);
    window.addEventListener('scroll', recolocar, true);
    return () => {
      document.removeEventListener('pointerdown', cerrarFuera);
      window.removeEventListener('resize', recolocar);
      window.removeEventListener('scroll', recolocar, true);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    menuRef.current?.querySelector<HTMLElement>(`[data-fecha="${fechaActiva}"]`)?.focus();
  }, [abierto, fechaActiva, mesVisible]);

  const cambiarFecha = (nuevaFecha: string) => {
    const input = inputRef.current;
    if (input) {
      input.value = nuevaFecha;
      onChange({ target: input, currentTarget: input } as React.ChangeEvent<HTMLInputElement>);
    }
    setAbierto(false);
    inputRef.current?.focus();
  };

  const abrir = () => {
    if (disabled) return;
    const inicial = desdeIso(value) ?? hoy;
    setMesVisible(new Date(inicial.getFullYear(), inicial.getMonth(), 1));
    setFechaActiva(fechaIso(inicial));
    setAbierto(true);
  };

  const estaEnRango = (fecha: Date) => (!minDate || fecha >= minDate) && (!maxDate || fecha <= maxDate);
  const puedeMes = (direccion: number) => {
    const destino = sumarMes(mesVisible, direccion);
    const primero = new Date(destino.getFullYear(), destino.getMonth(), 1);
    const ultimo = new Date(destino.getFullYear(), destino.getMonth() + 1, 0);
    return (!minDate || ultimo >= minDate) && (!maxDate || primero <= maxDate);
  };

  const moverFechaActiva = (fecha: Date) => {
    if (!estaEnRango(fecha)) return;
    setFechaActiva(fechaIso(fecha));
    setMesVisible(new Date(fecha.getFullYear(), fecha.getMonth(), 1));
  };

  const mostrarFecha = fechaElegida
    ? `${String(fechaElegida.getDate()).padStart(2, '0')}/${String(fechaElegida.getMonth() + 1).padStart(2, '0')}/${fechaElegida.getFullYear()}`
    : '';

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} disabled={disabled} /> : null}
      <div className="relative w-full">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={mostrarFecha}
        placeholder="Selecciona una fecha"
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-readonly="true"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        onClick={abrir}
        onBeforeInput={(evento) => evento.preventDefault()}
        onPaste={(evento) => evento.preventDefault()}
        onChange={(evento) => { evento.preventDefault(); evento.currentTarget.value = mostrarFecha; }}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter' || evento.key === ' ' || evento.key === 'ArrowDown') {
            evento.preventDefault();
            abrir();
          } else if (evento.key === 'Escape' && abierto) setAbierto(false);
        }}
        className={`${className} pr-12`}
      />
      <button
        ref={botonRef}
        type="button"
        tabIndex={-1}
        aria-label={abierto ? 'Cerrar calendario' : 'Abrir calendario'}
        disabled={disabled}
        onClick={abierto ? () => setAbierto(false) : abrir}
        className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)] disabled:opacity-50"
      >
        <CalendarDays className="h-5 w-5" aria-hidden="true" />
      </button>
      </div>
      {abierto && posicion ? createPortal(
        <div
          ref={menuRef}
          id={idMenu}
          role="dialog"
          aria-label={ariaLabel ? `Calendario: ${ariaLabel}` : 'Elegir fecha'}
          onKeyDown={(evento) => {
            if (evento.key === 'Escape') {
              evento.preventDefault();
              setAbierto(false);
              inputRef.current?.focus();
            }
          }}
          className="fixed z-[1000] overflow-y-auto overscroll-contain rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-4 text-[var(--fin-ink)] shadow-2xl"
          style={{ left: posicion.left, top: posicion.top, width: posicion.width, maxHeight: posicion.maxHeight }}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMesVisible(sumarMes(mesVisible, -1))}
              disabled={!puedeMes(-1)}
              aria-label="Mes anterior"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)] disabled:opacity-30"
            ><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
            <h2 className="flex-1 text-center text-base font-bold capitalize">{formatoMes.format(mesVisible)}</h2>
            <button
              type="button"
              onClick={() => setMesVisible(sumarMes(mesVisible, 1))}
              disabled={!puedeMes(1)}
              aria-label="Mes siguiente"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)] disabled:opacity-30"
            ><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
          </div>

          <div role="grid" aria-label={formatoMes.format(mesVisible)} className="mt-2 grid grid-cols-7 gap-1 text-center">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((dia, indice) => (
              <span key={`${dia}-${indice}`} role="columnheader" aria-label={['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][indice]} className="py-2 text-xs font-semibold text-[var(--fin-ink-faint)]">{dia}</span>
            ))}
            {dias.map((fecha) => {
              const iso = fechaIso(fecha);
              const seleccionada = iso === value;
              const esHoy = iso === fechaIso(hoy);
              const enMes = igualMes(fecha, mesVisible);
              const habilitada = estaEnRango(fecha);
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  data-fecha={iso}
                  aria-label={formatoLargo.format(fecha)}
                  aria-selected={seleccionada}
                  aria-current={esHoy ? 'date' : undefined}
                  disabled={!habilitada}
                  tabIndex={iso === fechaActiva ? 0 : -1}
                  onClick={() => cambiarFecha(iso)}
                  onKeyDown={(evento) => {
                    const diasDeSalto: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
                    if (diasDeSalto[evento.key]) {
                      evento.preventDefault();
                      moverFechaActiva(new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + diasDeSalto[evento.key]));
                    } else if (evento.key === 'Home' || evento.key === 'End') {
                      evento.preventDefault();
                      const lunes = fecha.getDate() - ((fecha.getDay() + 6) % 7);
                      moverFechaActiva(new Date(fecha.getFullYear(), fecha.getMonth(), lunes + (evento.key === 'End' ? 6 : 0)));
                    } else if (evento.key === 'PageUp' || evento.key === 'PageDown') {
                      evento.preventDefault();
                      const nuevoMes = sumarMes(fecha, evento.key === 'PageUp' ? -1 : 1);
                      moverFechaActiva(new Date(nuevoMes.getFullYear(), nuevoMes.getMonth(), Math.min(fecha.getDate(), new Date(nuevoMes.getFullYear(), nuevoMes.getMonth() + 1, 0).getDate())));
                    }
                  }}
                  className={`relative mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors ${seleccionada ? 'bg-[var(--fin-accent)] font-bold text-[var(--fin-on-accent)] shadow-sm' : esHoy ? 'font-bold text-[var(--fin-accent)] ring-1 ring-[var(--fin-accent)]' : 'text-[var(--fin-ink)] hover:bg-[var(--fin-soft)]'} ${enMes ? '' : 'opacity-45'} disabled:cursor-not-allowed disabled:opacity-20`}
                >
                  {fecha.getDate()}
                  {seleccionada ? <Check className="sr-only" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[var(--fin-line)] pt-3">
            {!required ? <button type="button" onClick={() => cambiarFecha('')} className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]">Limpiar</button> : <span />}
            <button
              type="button"
              onClick={() => { if (estaEnRango(hoy)) cambiarFecha(fechaIso(hoy)); }}
              disabled={!estaEnRango(hoy)}
              className="rounded-xl px-3 py-2 text-sm font-bold text-[var(--fin-accent)] hover:bg-[var(--fin-soft)] disabled:opacity-40"
            >Hoy</button>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
};
