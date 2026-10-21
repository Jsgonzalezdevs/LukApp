import { etiquetaIcono } from '../lib/etiquetaIcono';
import { useGuardadoFinanciero, type ResultadoGuardado } from '../hooks/useGuardadoFinanciero';
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Lock, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import type { Transaction } from '../types';
import {
  COLORES_CATEGORIA,
  EMOJIS_POPULARES_CATEGORIA,
  ICONOS_CATEGORIA,
  iconoDeCategoria,
  sugerirIconoCategoria,
  sugerirEmojiCategoria,
} from '../categorias';
import type { CategoriaPersonal } from '../categorias';
import { useCatalogo } from '../catalogoContexto';
import { tint } from '../types';
import { RippleButton } from './RippleButton';

export interface CategoriasEditorProps {
  categorias: readonly CategoriaPersonal[];
  transacciones: readonly Transaction[];
  onCrear: (datos: Omit<CategoriaPersonal, 'id' | 'createdAt' | 'archivedAt'>) => ResultadoGuardado;
  onActualizar: (categoria: CategoriaPersonal) => ResultadoGuardado;
  onArchivar: (id: string) => ResultadoGuardado;
  onBorrar: (id: string) => ResultadoGuardado;
}

/** 16px minimum: anything smaller makes iOS zoom the page in on focus. */
const CAMPO =
  'w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-3 text-[17px] font-normal text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none';

const SelectorEmoji: React.FC<{ valor: string; onCambiar: (v: string) => void }> = ({
  valor,
  onCambiar,
}) => (
  <div>
    <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto pr-1" role="radiogroup" aria-label="Emoji">
      {EMOJIS_POPULARES_CATEGORIA.map((emoji) => {
        const activo = valor === emoji;
        return (
          <button
            key={emoji}
            type="button"
            role="radio"
            aria-checked={activo}
            aria-label={`Emoji ${emoji}`}
            onClick={() => onCambiar(emoji)}
            className={`flex h-11 w-11 items-center justify-center rounded-[var(--fin-r-control)] border text-[20px] transition-all ${
              activo
                ? 'border-[var(--fin-ink)] bg-[var(--fin-soft)] scale-105 shadow-xs ring-2 ring-[var(--fin-ink)]/20'
                : 'border-[var(--fin-line)] bg-[var(--fin-card)] hover:border-[var(--fin-ink-faint)]'
            }`}
          >
            {emoji}
          </button>
        );
      })}
    </div>

    <div className="mt-2.5 flex items-center gap-2">
      <input
        type="text"
        value={valor}
        onChange={(e) => {
          const v = e.target.value;
          if (v.trim()) onCambiar(v.trim());
        }}
        aria-label="Emoji personalizado"
        placeholder="O escribe tu propio emoji (ej: 🍕, 🚀, 🐱)"
        className="flex-1 rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2 text-[17px] text-[var(--fin-ink)] focus:outline-hidden focus:ring-2 focus:ring-[var(--fin-ink)]"
      />
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--fin-soft)] text-[20px] border border-[var(--fin-line)] shrink-0">
        {valor || '🏷️'}
      </span>
    </div>
  </div>
);

const SelectorIcono: React.FC<{ valor: string; onCambiar: (v: string) => void }> = ({
  valor,
  onCambiar,
}) => (
  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ícono">
    {ICONOS_CATEGORIA.map((nombre) => {
      const Icono = iconoDeCategoria(nombre);
      const activo = valor === nombre;
      return (
        <button
          key={nombre}
          type="button"
          role="radio"
          aria-checked={activo}
          aria-label={etiquetaIcono(nombre)}
          onClick={() => onCambiar(nombre)}
          className={`flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-control)] border-2 transition-colors ${
            activo
              ? 'border-[var(--fin-ink)] text-[var(--fin-ink)]'
              : 'border-[var(--fin-line)] text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink-soft)]'
          }`}
        >
          <Icono className="h-4 w-4" aria-hidden="true" />
        </button>
      );
    })}
  </div>
);

const SelectorColor: React.FC<{ valor: string; onCambiar: (v: string) => void }> = ({
  valor,
  onCambiar,
}) => (
  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
    {COLORES_CATEGORIA.map((color) => {
      const activo = valor.toUpperCase() === color;
      return (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={activo}
          aria-label={`Color ${color}`}
          onClick={() => onCambiar(color)}
          className={`h-9 w-9 rounded-[var(--fin-r-control)] border-2 transition-transform ${
            activo ? 'scale-110 border-[var(--fin-ink)]' : 'border-transparent'
          }`}
          style={{ backgroundColor: color }}
        >
          {activo ? <Check className="mx-auto h-4 w-4 text-white" strokeWidth={3} /> : null}
        </button>
      );
    })}
  </div>
);

const Formulario: React.FC<{
  inicial?: CategoriaPersonal;
  onGuardar: (datos: { nombre: string; icon: string; emoji: string; color: string }) => ResultadoGuardado;
  onCancelar: () => void;
}> = ({ inicial, onGuardar, onCancelar }) => {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [icon, setIcon] = useState(inicial?.icon ?? 'Package');
  const [emoji, setEmoji] = useState(inicial?.emoji ?? sugerirEmojiCategoria(inicial?.nombre ?? ''));
  const [color, setColor] = useState<string>(inicial?.color ?? COLORES_CATEGORIA[0]);
  const [manual, setManual] = useState(inicial !== undefined);

  const listo = nombre.trim() !== '';

  const cambiarNombre = (valor: string) => {
    setNombre(valor);
    if (!manual) {
      setIcon(sugerirIconoCategoria(valor));
      setEmoji(sugerirEmojiCategoria(valor));
    }
  };

  const guardado = useGuardadoFinanciero();
  const cambiarIconoManual = (valor: string) => {
    setManual(true);
    setIcon(valor);
  };

  const cambiarEmojiManual = (valor: string) => {
    setManual(true);
    setEmoji(valor);
  };

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!listo) return;
        await guardado.ejecutar(() => onGuardar({ nombre: nombre.trim(), icon, emoji, color }));
      }}
      className="overflow-hidden rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4 border border-[var(--fin-line)]"
    >
      {guardado.error ? <p role="alert" className="text-sm text-[var(--fin-out)]">{guardado.error}</p> : null}
      <div className="flex items-center gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--fin-r-card)] text-[28px] shadow-xs"
          style={{ backgroundColor: tint(color, 0.2) }}
        >
          <span aria-hidden="true">{emoji || '🏷️'}</span>
        </span>
        <div className="flex-1 min-w-0">
          <label
            htmlFor="cat-nombre"
            className="block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
          >
            Nombre
          </label>
          <input
            id="cat-nombre"
            value={nombre}
            onChange={(e) => cambiarNombre(e.target.value)}
            placeholder="Ej: Mercado, Viajes, Almuerzo..."
            maxLength={28}
            autoFocus
            className={`mt-2 ${CAMPO}`}
          />
        </div>
      </div>

      <p className="mt-4 text-[15px] font-semibold text-[var(--fin-ink-soft)]">Emoji</p>
      <div className="mt-2">
        <SelectorEmoji valor={emoji} onCambiar={cambiarEmojiManual} />
      </div>

      <p className="mt-4 text-[15px] font-semibold text-[var(--fin-ink-soft)]">Ícono alternativo</p>
      <div className="mt-2">
        <SelectorIcono valor={icon} onCambiar={cambiarIconoManual} />
      </div>

      <p className="mt-4 text-[15px] font-semibold text-[var(--fin-ink-soft)]">Color</p>
      <div className="mt-2">
        <SelectorColor valor={color} onCambiar={setColor} />
      </div>

      <div className="mt-5 flex gap-2">
        <RippleButton
          type="submit"
          disabled={!listo}
          rippleColor="rgba(255,255,255,0.5)"
          className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-3 text-[17px] font-semibold text-[var(--fin-on-accent)] disabled:opacity-30 shadow-xs"
        >
          {inicial ? 'Guardar cambios' : 'Crear categoría'}
        </RippleButton>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-[var(--fin-r-control)] border border-[var(--fin-line)] px-4 py-3 text-[17px] font-semibold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"
        >
          Cancelar
        </button>
      </div>
    </motion.form>
  );
};

export const CategoriasEditor: React.FC<CategoriasEditorProps> = ({
  categorias,
  transacciones,
  onCrear,
  onActualizar,
  onArchivar,
  onBorrar,
}) => {
  const catalogo = useCatalogo();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  const usos = new Map<string, number>();
  for (const tx of transacciones) usos.set(tx.category, (usos.get(tx.category) ?? 0) + 1);

  const basicas = catalogo.todas.filter((c) => !c.propia);
  const propias = [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return (
    <section>
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-[15px] font-semibold text-[var(--fin-ink-soft)]">Categorías</h2>
        {!creando && editando === null ? (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="flex items-center gap-2 rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2 text-[15px] font-semibold text-[var(--fin-ink)] shadow-xs hover:bg-[var(--fin-soft)]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            Nueva
          </button>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {creando ? (
          <div className="mt-2">
            <Formulario
              onGuardar={async (datos) => {
                if (await onCrear(datos) === false) return false;
                setCreando(false);
                return true;
              }}
              onCancelar={() => setCreando(false)}
            />
          </div>
        ) : null}
      </AnimatePresence>

      <ul className="mt-3 flex flex-col gap-2">
        {propias.length === 0 && !creando ? (
          <li className="rounded-[var(--fin-r-card)] border border-dashed border-[var(--fin-line)] px-4 py-5 text-center text-[15px] text-[var(--fin-ink-soft)]">
            Aún no tienes categorías propias. Crea una para clasificar mejor tus movimientos.
          </li>
        ) : null}
        {propias.map((cat, idx) => {
          const enUso = usos.get(cat.id) ?? 0;
          const archivada = cat.archivedAt !== null;

          if (editando === cat.id) {
            return (
              <li key={cat.id}>
                <Formulario
                  inicial={cat}
                  onGuardar={async (datos) => {
                    if (await onActualizar({ ...cat, ...datos }) === false) return false;
                    setEditando(null);
                    return true;
                  }}
                  onCancelar={() => setEditando(null)}
                />
              </li>
            );
          }

          const emojiActual = cat.emoji || sugerirEmojiCategoria(cat.nombre);

          return (
            <motion.li
              key={cat.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(idx, 8) * 0.03, ease: 'easeOut' }}
              className={`flex items-center gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] px-4 py-3 border border-[var(--fin-line)] shadow-xs ${
                archivada ? 'opacity-55' : ''
              }`}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--fin-r-card)] text-[20px] select-none"
                style={{ backgroundColor: tint(cat.color, 0.18) }}
              >
                <span aria-hidden="true">{emojiActual}</span>
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold text-[var(--fin-ink)]">
                  {cat.nombre}
                </span>
                <span className="block text-[13px] text-[var(--fin-ink-faint)]">
                  {archivada ? 'Archivada · ' : ''}
                  {enUso === 0 ? 'sin movimientos' : `${enUso} movimiento${enUso === 1 ? '' : 's'}`}
                </span>
              </span>

              {archivada ? (
                <button
                  type="button"
                  onClick={() => onActualizar({ ...cat, archivedAt: null })}
                  aria-label={`Reactivar ${cat.nombre}`}
                  className="rounded-[var(--fin-r-control)] p-2 text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
                >
                  <RotateCcw className="h-4 w-4" strokeWidth={2.5} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditando(cat.id)}
                  aria-label={`Editar ${cat.nombre}`}
                  className="rounded-[var(--fin-r-control)] p-2 text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
                >
                  <Pencil className="h-4 w-4" strokeWidth={2.5} />
                </button>
              )}

              <button
                type="button"
                onClick={() => (enUso === 0 ? onBorrar(cat.id) : onArchivar(cat.id))}
                disabled={archivada && enUso > 0}
                aria-label={enUso === 0 ? `Eliminar ${cat.nombre}` : `Archivar ${cat.nombre}`}
                className="rounded-[var(--fin-r-control)] p-2 text-[var(--fin-ink-faint)] hover:text-[var(--fin-out)] disabled:opacity-30"
              >
                {enUso === 0 ? (
                  <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <X className="h-4 w-4" strokeWidth={2.5} />
                )}
              </button>
            </motion.li>
          );
        })}
      </ul>

      <p className="mt-6 px-1 text-[15px] font-semibold text-[var(--fin-ink-soft)]">
        Categorías principales del sistema
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {basicas.map((cat) => (
          <li
            key={cat.clave}
            className="flex items-center gap-2 rounded-full border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2 text-[15px] font-medium text-[var(--fin-ink)] shadow-xs"
          >
            <span className="text-[17px]"><span aria-hidden="true">{cat.emoji}</span></span>
            <span>{cat.nombre}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-start gap-2 px-1 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
        <Lock className="mt-1 h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
        Estas no se editan: el dictado por voz y las plantillas de extracto las reconocen automáticamente.
      </p>
    </section>
  );
};
