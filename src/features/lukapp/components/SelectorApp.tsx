import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

type Opcion = { valor: string; texto: React.ReactNode; deshabilitada: boolean };
type Props = {
  id?: string;
  value?: string | number;
  defaultValue?: string | number;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  form?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  children: React.ReactNode;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
};

const aplanarOpciones = (nodos: React.ReactNode): Opcion[] => React.Children.toArray(nodos).flatMap((nodo) => {
  if (!React.isValidElement<{ value?: string | number; disabled?: boolean; children?: React.ReactNode }>(nodo)) return [];
  if (nodo.type === React.Fragment) return aplanarOpciones(nodo.props.children);
  if (nodo.type !== 'option') return [];
  const texto = nodo.props.children;
  const valor = String(nodo.props.value ?? (typeof texto === 'string' ? texto : ''));
  return [{ valor, texto, deshabilitada: Boolean(nodo.props.disabled) }];
});

/** Selector consistente de LukApp; el select oculto conserva formularios y eventos React. */
export const SelectorApp: React.FC<Props> = ({
  id,
  value,
  defaultValue,
  onChange,
  children,
  className = '',
  disabled,
  required,
  name,
  form,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}) => {
  const opciones = useMemo(() => aplanarOpciones(children), [children]);
  const [seleccionInterna, setSeleccionInterna] = useState(String(defaultValue ?? ''));
  const [abierto, setAbierto] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(0);
  const [posicion, setPosicion] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const idGenerado = useId();
  const idMenu = `selector-${id ?? idGenerado}`;
  const valor = value === undefined ? seleccionInterna : String(value);
  const indiceSeleccionado = opciones.findIndex((opcion) => opcion.valor === valor);
  const opcionSeleccionada = opciones[indiceSeleccionado];

  const actualizarPosicion = () => {
    const caja = botonRef.current?.getBoundingClientRect();
    if (!caja) return;
    const margen = 8;
    const altoDeseado = Math.min(320, window.innerHeight - margen * 2);
    const espacioAbajo = window.innerHeight - caja.bottom - margen;
    const espacioArriba = caja.top - margen;
    const abrirArriba = espacioAbajo < Math.min(220, altoDeseado) && espacioArriba > espacioAbajo;
    const alto = Math.min(altoDeseado, abrirArriba ? espacioArriba : espacioAbajo);
    const ancho = Math.min(window.innerWidth - margen * 2, Math.max(caja.width, 280));
    setPosicion({
      left: Math.max(margen, Math.min(caja.left, window.innerWidth - ancho - margen)),
      top: abrirArriba ? Math.max(margen, caja.top - alto - 6) : caja.bottom + 6,
      width: ancho,
      maxHeight: Math.max(120, alto),
    });
  };

  useEffect(() => {
    if (!abierto) return;
    actualizarPosicion();
    const cerrarFuera = (evento: PointerEvent) => {
      const destino = evento.target as Node;
      if (!botonRef.current?.contains(destino) && !menuRef.current?.contains(destino)) setAbierto(false);
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
    if (indiceSeleccionado >= 0) setIndiceActivo(indiceSeleccionado);
  }, [indiceSeleccionado]);

  useEffect(() => {
    if (abierto) menuRef.current?.querySelector<HTMLElement>(`[data-indice="${indiceActivo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [abierto, indiceActivo]);

  const elegir = (opcion: Opcion) => {
    if (opcion.deshabilitada || disabled) return;
    if (value === undefined) setSeleccionInterna(opcion.valor);
    const select = selectRef.current;
    if (select) {
      select.value = opcion.valor;
      onChange?.({ target: select, currentTarget: select } as React.ChangeEvent<HTMLSelectElement>);
    }
    setAbierto(false);
    botonRef.current?.focus();
  };

  const moverActivo = (paso: number) => {
    if (opciones.length === 0) return;
    let siguiente = indiceActivo;
    for (let intentos = 0; intentos < opciones.length; intentos += 1) {
      siguiente = (siguiente + paso + opciones.length) % opciones.length;
      if (!opciones[siguiente]?.deshabilitada) break;
    }
    setIndiceActivo(siguiente);
    menuRef.current?.querySelector<HTMLElement>(`[data-indice="${siguiente}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  const manejarTecla = (evento: React.KeyboardEvent<HTMLButtonElement>) => {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!abierto) {
        setIndiceActivo(indiceSeleccionado >= 0 ? indiceSeleccionado : 0);
        setAbierto(true);
      } else moverActivo(evento.key === 'ArrowDown' ? 1 : -1);
    } else if ((evento.key === 'Enter' || evento.key === ' ') && abierto) {
      evento.preventDefault();
      const opcion = opciones[indiceActivo];
      if (opcion) elegir(opcion);
    } else if (evento.key === 'Escape' && abierto) {
      evento.preventDefault();
      setAbierto(false);
    } else if (evento.key === 'Home' && abierto) {
      evento.preventDefault();
      const primero = opciones.findIndex((opcion) => !opcion.deshabilitada);
      if (primero >= 0) setIndiceActivo(primero);
    } else if (evento.key === 'End' && abierto) {
      evento.preventDefault();
      let ultimo = -1;
      for (let indice = opciones.length - 1; indice >= 0; indice -= 1) {
        if (!opciones[indice].deshabilitada) { ultimo = indice; break; }
      }
      if (ultimo >= 0) setIndiceActivo(ultimo);
    }
  };

  return (
    <>
      <select
        ref={selectRef}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute h-px w-px opacity-0"
        value={valor}
        name={name}
        form={form}
      >
        {opciones.map((opcion, indice) => <option key={`${opcion.valor}-${indice}`} value={opcion.valor} disabled={opcion.deshabilitada}>{opcion.texto}</option>)}
      </select>
      <button
        ref={botonRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-required={required || undefined}
        aria-controls={abierto ? idMenu : undefined}
        aria-activedescendant={abierto ? `${idMenu}-opcion-${indiceActivo}` : undefined}
        disabled={disabled}
        onClick={() => { if (!disabled) setAbierto((actual) => !actual); }}
        onKeyDown={manejarTecla}
        className={`relative flex min-h-11 min-w-0 items-center justify-between gap-3 text-left ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">{opcionSeleccionada?.texto ?? opciones[0]?.texto ?? 'Selecciona una opción'}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--fin-ink-faint)] transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {abierto && posicion && typeof document !== 'undefined' ? createPortal(
        <div
          ref={menuRef}
          id={idMenu}
          role="listbox"
          aria-label={ariaLabel ?? 'Opciones'}
          className="fixed z-[1000] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-1.5 text-[var(--fin-ink)] shadow-2xl"
          style={{ left: posicion.left, top: posicion.top, width: posicion.width, maxHeight: posicion.maxHeight }}
        >
          {opciones.map((opcion, indice) => {
            const seleccionada = opcion.valor === valor;
            const activa = indice === indiceActivo;
            return (
              <button
                key={`${opcion.valor}-${indice}`}
                id={`${idMenu}-opcion-${indice}`}
                type="button"
                role="option"
                aria-selected={seleccionada}
                disabled={opcion.deshabilitada}
                tabIndex={-1}
                data-indice={indice}
                onMouseEnter={() => setIndiceActivo(indice)}
                onClick={() => elegir(opcion)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-base transition-colors ${activa ? 'bg-[var(--fin-accent)]/12 text-[var(--fin-ink)]' : 'text-[var(--fin-ink-soft)]'} ${opcion.deshabilitada ? 'cursor-not-allowed opacity-50' : 'hover:bg-[var(--fin-soft)]'} ${seleccionada ? 'font-semibold' : 'font-normal'}`}
              >
                <span className="min-w-0 flex-1 break-words">{opcion.texto}</span>
                {seleccionada ? <Check className="h-4 w-4 shrink-0 text-[var(--fin-accent)]" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>,
        document.body,
      ) : null}
    </>
  );
};
