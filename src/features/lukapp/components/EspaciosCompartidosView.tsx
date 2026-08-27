import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { formatCop, parseSaldoInput } from '../lib/formatCop';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useAudioFeedback } from '../hooks/useAudioFeedback';
import { RippleButton } from './RippleButton';
import {
  useEspaciosCompartidos,
  type EspacioCompartido,
} from '../data/useEspaciosCompartidos';

interface EspaciosCompartidosViewProps {
  onCerrar: () => void;
  onAnotarEnLukApp?: (montoCop: number, descripcion: string, categoria: string) => void;
}

const EMOJIS_ESPACIO = ['🥑', '🏠', '✈️', '🍷', '🍕', '🏖️', '🛒', '🚗', '☕', '🎁'];
const EMOJIS_PAREJA = ['👩🏼', '👦🏼', '👧🏽', '🧑🏻', '👩🏻', '🧔🏽', '👱🏼‍♀️', '🐶', '🐱'];

export const EspaciosCompartidosView: React.FC<EspaciosCompartidosViewProps> = ({
  onCerrar,
  onAnotarEnLukApp,
}) => {
  const haptic = useHapticFeedback();
  const audio = useAudioFeedback();

  const {
    espacios,
    crearEspacio,
    agregarGasto,
    borrarGasto,
    saldarCuentas,
  } = useEspaciosCompartidos();

  const [espacioIdActivo, setEspacioIdActivo] = useState<string>(
    espacios[0]?.id ?? 'espacio-pareja-demo',
  );

  const [modalGastoAbierto, setModalGastoAbierto] = useState(false);
  const [modalNuevoEspacioAbierto, setModalNuevoEspacioAbierto] = useState(false);
  const [mensajeCopiado, setMensajeCopiado] = useState(false);

  // Formulario de nuevo gasto
  const [descGasto, setDescGasto] = useState('');
  const [montoGastoTexto, setMontoGastoTexto] = useState('');
  const [pagadoPorId, setPagadoPorId] = useState<string>('yo');
  const [guardarEnPersonal, setGuardarEnPersonal] = useState(true);

  // Formulario de nuevo espacio
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoIcono, setNuevoIcono] = useState('🥑');
  const [nombrePareja, setNombrePareja] = useState('');
  const [emojiPareja, setEmojiPareja] = useState('👩🏼');

  const espacioActivo: EspacioCompartido | undefined =
    espacios.find((e) => e.id === espacioIdActivo) || espacios[0];

  // Cálculos de balances del espacio activo
  const integrantes = espacioActivo?.integrantes || [];
  const gastos = espacioActivo?.gastos || [];

  const totalGastado = gastos.reduce((sum, g) => sum + g.montoCop, 0);
  const pagadoPorYo = gastos
    .filter((g) => g.pagadoPorId === 'yo')
    .reduce((sum, g) => sum + g.montoCop, 0);
  const pagadoPorOtro = totalGastado - pagadoPorYo;

  const mitadTeorica = totalGastado / 2;
  // Si pagué más de la mitad, me deben; si pagué menos, debo
  const balanceYo = pagadoPorYo - mitadTeorica;
  const nombreOtro = integrantes.find((i) => i.id !== 'yo')?.nombre || 'Tu pareja';

  const handleCrearEspacio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;
    haptic.trigger('medium');
    audio.play('click');
    const nuevo = crearEspacio(
      nuevoNombre.trim(),
      nuevoIcono,
      '#8b5cf6',
      nombrePareja.trim() || 'Compañero/a',
      emojiPareja,
    );
    setEspacioIdActivo(nuevo.id);
    setNuevoNombre('');
    setNombrePareja('');
    setModalNuevoEspacioAbierto(false);
  };

  const handleGuardarGasto = (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseSaldoInput(montoGastoTexto) ?? 0;
    if (!descGasto.trim() || monto <= 0 || !espacioActivo) return;

    haptic.trigger('medium');
    audio.play('click');

    agregarGasto(espacioActivo.id, descGasto.trim(), monto, pagadoPorId, 'otros');

    if (guardarEnPersonal && onAnotarEnLukApp && pagadoPorId === 'yo') {
      // Registrar la mitad correspondiente en la contabilidad personal de LukApp
      onAnotarEnLukApp(
        Math.round(monto / 2),
        `Mi mitad: ${descGasto.trim()} (${espacioActivo.nombre})`,
        'otros',
      );
    }

    setDescGasto('');
    setMontoGastoTexto('');
    setModalGastoAbierto(false);
  };

  const compartirWhatsApp = async () => {
    if (!espacioActivo) return;
    haptic.trigger('medium');
    audio.play('click');

    let textoBalance = '🤝 *¡Están al día y a mano!*';
    if (balanceYo > 0) {
      textoBalance = `👉 *${nombreOtro} le debe a Tú: ${formatCop(balanceYo)}*`;
    } else if (balanceYo < 0) {
      textoBalance = `👉 *Tú le debe a ${nombreOtro}: ${formatCop(Math.abs(balanceYo))}*`;
    }

    const texto =
      `🥑 *Cuentas Claras en LukApp — «${espacioActivo.nombre}»*\n\n` +
      `• Total acumulado: ${formatCop(totalGastado)}\n` +
      `• Pagó Tú: ${formatCop(pagadoPorYo)}\n` +
      `• Pagó ${nombreOtro}: ${formatCop(pagadoPorOtro)}\n\n` +
      `${textoBalance}\n\n` +
      `📲 ¡Gracias por pasarme tu parte por Nequi o Bancolombia!`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(texto);
        setMensajeCopiado(true);
        setTimeout(() => setMensajeCopiado(false), 3000);
      }
      // Abrir WhatsApp web o app
      const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
      window.open(url, '_blank');
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl min-h-screen sm:min-h-0 sm:max-h-[92vh] sm:rounded-[32px] border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 sm:p-7 shadow-2xl flex flex-col overflow-y-auto">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-[var(--fin-line)]/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500 text-[22px]">
              ❤️
            </div>
            <div>
              <h2 className="text-[19px] font-bold text-[var(--fin-ink)]">
                Finanzas en Pareja y Compartidas
              </h2>
              <p className="text-[12.5px] text-[var(--fin-ink-soft)]">
                Planifica en equipo y lleva las cuentas claras sin discusiones
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full p-2 text-[var(--fin-ink-faint)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selector horizontal de espacios */}
        <div className="flex items-center gap-2 overflow-x-auto py-3 no-scrollbar">
          {espacios.map((esp) => {
            const activo = esp.id === espacioActivo?.id;
            return (
              <button
                key={esp.id}
                type="button"
                onClick={() => setEspacioIdActivo(esp.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-semibold whitespace-nowrap transition-all ${
                  activo
                    ? 'bg-[var(--fin-ink)] text-[var(--fin-bg)] shadow-sm scale-100'
                    : 'bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]'
                }`}
              >
                <span>{esp.icono}</span>
                <span>{esp.nombre}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setModalNuevoEspacioAbierto(true)}
            className="flex items-center gap-1.5 rounded-full border border-dashed border-[var(--fin-line)] px-3.5 py-2 text-[13px] font-medium text-[var(--fin-ink-soft)] hover:border-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)] whitespace-nowrap transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo espacio</span>
          </button>
        </div>

        {espacioActivo ? (
          <div className="flex-1 flex flex-col gap-4 mt-2">
            {/* Tarjeta Visual de los Avatares e Ilustración de Pareja */}
            <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-rose-500/10 via-[var(--fin-soft)] to-indigo-500/10 border border-[var(--fin-line)] p-5 text-center">
              {/* Avatares circulares superpuestos (Estilo Monai / Memoji de referencia) */}
              <div className="flex items-center justify-center -space-x-4 mb-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fed7aa] border-4 border-[var(--fin-card)] text-[28px] shadow-md z-10">
                  {integrantes[0]?.emoji || '👦🏼'}
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fbcfe8] border-4 border-[var(--fin-card)] text-[28px] shadow-md z-20">
                  {integrantes[1]?.emoji || '👩🏼'}
                </div>
              </div>

              <h3 className="text-[17px] font-bold text-[var(--fin-ink)]">
                {integrantes[0]?.nombre || 'Tú'} & {integrantes[1]?.nombre || 'Pareja'}
              </h3>
              <p className="text-[12px] text-[var(--fin-ink-soft)] uppercase tracking-wider font-semibold mt-0.5">
                Espacio: {espacioActivo.nombre}
              </p>

              {/* Caja de Balance Principal */}
              <div className="mt-4 rounded-2xl bg-[var(--fin-card)] border border-[var(--fin-line)] p-4 shadow-xs">
                <span className="text-[11.5px] uppercase tracking-wider font-bold text-[var(--fin-ink-faint)]">
                  Estado de Cuentas
                </span>

                <div className="mt-1.5">
                  {balanceYo > 0 ? (
                    <div className="text-[22px] sm:text-[26px] font-extrabold text-emerald-600 dark:text-emerald-400">
                      {nombreOtro} te debe {formatCop(balanceYo)}
                    </div>
                  ) : balanceYo < 0 ? (
                    <div className="text-[22px] sm:text-[26px] font-extrabold text-rose-600 dark:text-rose-400">
                      Le debes {formatCop(Math.abs(balanceYo))} a {nombreOtro}
                    </div>
                  ) : (
                    <div className="text-[22px] sm:text-[26px] font-extrabold text-[var(--fin-ink)]">
                      ¡Están a mano! 🤝
                    </div>
                  )}
                </div>

                {/* Desglose de aportes */}
                <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-[var(--fin-line)]/50 text-[12.5px]">
                  <div>
                    <span className="text-[var(--fin-ink-soft)]">Pagado por Ti:</span>
                    <div className="font-bold text-[var(--fin-ink)] tabular-nums">
                      {formatCop(pagadoPorYo)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[var(--fin-ink-soft)]">Pagado por {nombreOtro}:</span>
                    <div className="font-bold text-[var(--fin-ink)] tabular-nums">
                      {formatCop(pagadoPorOtro)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción del balance */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <RippleButton
                  onClick={() => setModalGastoAbierto(true)}
                  className="flex items-center gap-2 rounded-full bg-[var(--fin-ink)] text-[var(--fin-bg)] px-4 py-2.5 text-[13.5px] font-bold shadow-md hover:opacity-90 active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>Anotar gasto compartido</span>
                </RippleButton>

                <button
                  type="button"
                  onClick={compartirWhatsApp}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-4 py-2.5 text-[13.5px] font-bold shadow-md hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  {mensajeCopiado ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                  <span>{mensajeCopiado ? '¡Copiado!' : 'WhatsApp'}</span>
                </button>

                {gastos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('¿Confirmas que ya se transfirieron el dinero y están a paz y salvo?')) {
                        saldarCuentas(espacioActivo.id);
                      }
                    }}
                    className="flex items-center gap-1 rounded-full border border-[var(--fin-line)] bg-[var(--fin-card)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)] hover:bg-[var(--fin-soft)]"
                  >
                    <span>Saldar a $0</span>
                  </button>
                )}
              </div>
            </div>

            {/* Listado de movimientos del espacio */}
            <div className="mt-2 flex-1">
              <div className="flex items-center justify-between mb-2 px-1">
                <h4 className="text-[14px] font-bold text-[var(--fin-ink)]">
                  Gastos del Espacio ({gastos.length})
                </h4>
                <span className="text-[12px] font-medium text-[var(--fin-ink-soft)]">
                  Total: {formatCop(totalGastado)}
                </span>
              </div>

              {gastos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--fin-line)] p-8 text-center text-[var(--fin-ink-faint)]">
                  <span className="text-[32px]">✨</span>
                  <p className="mt-2 text-[14px] font-medium text-[var(--fin-ink)]">
                    No hay gastos pendientes
                  </p>
                  <p className="text-[12px]">
                    Anota el primer gasto compartido tocando el botón de arriba.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                  {gastos.map((g) => {
                    const pagadoPorTi = g.pagadoPorId === 'yo';
                    return (
                      <div
                        key={g.id}
                        className="flex items-center justify-between rounded-2xl bg-[var(--fin-soft)]/60 border border-[var(--fin-line)]/60 p-3 text-[13.5px] transition-colors hover:bg-[var(--fin-soft)]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[18px]">
                            {pagadoPorTi ? '👦🏼' : '👩🏼'}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--fin-ink)] truncate">
                              {g.descripcion}
                            </div>
                            <div className="text-[11.5px] text-[var(--fin-ink-soft)]">
                              Pagó {pagadoPorTi ? 'Tú' : nombreOtro} • {g.fecha}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-[var(--fin-ink)] tabular-nums">
                            {formatCop(g.montoCop)}
                          </span>
                          <button
                            type="button"
                            onClick={() => borrarGasto(espacioActivo.id, g.id)}
                            className="p-1 text-[var(--fin-ink-faint)] hover:text-[var(--fin-out)] transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Modal: Anotar Gasto Compartido */}
        <AnimatePresence>
          {modalGastoAbierto && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-2xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[var(--fin-line)]/50">
                  <h3 className="text-[17px] font-bold text-[var(--fin-ink)]">
                    Nuevo Gasto Compartido
                  </h3>
                  <button
                    type="button"
                    onClick={() => setModalGastoAbierto(false)}
                    className="p-1 text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleGuardarGasto} className="mt-4 flex flex-col gap-3.5">
                  <div>
                    <label className="text-[12px] font-semibold text-[var(--fin-ink-soft)] uppercase tracking-wider">
                      ¿En qué fue el gasto?
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Mercado Éxito, Cena, Gasolina..."
                      value={descGasto}
                      onChange={(e) => setDescGasto(e.target.value)}
                      required
                      autoFocus
                      className="mt-1 w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-[16px] text-[var(--fin-ink)] focus:outline-hidden focus:ring-2 focus:ring-[var(--fin-ink)]"
                    />
                  </div>

                  <div>
                    <label className="text-[12px] font-semibold text-[var(--fin-ink-soft)] uppercase tracking-wider">
                      Monto total ($)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Ej. 180000"
                      value={montoGastoTexto}
                      onChange={(e) => setMontoGastoTexto(e.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-[16px] font-bold text-[var(--fin-ink)] tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[var(--fin-ink)]"
                    />
                  </div>

                  <div>
                    <label className="text-[12px] font-semibold text-[var(--fin-ink-soft)] uppercase tracking-wider">
                      ¿Quién pagó la cuenta?
                    </label>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPagadoPorId('yo')}
                        className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-[14px] font-bold transition-all ${
                          pagadoPorId === 'yo'
                            ? 'bg-[var(--fin-ink)] text-[var(--fin-bg)] shadow-xs'
                            : 'bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]'
                        }`}
                      >
                        <span>👦🏼</span>
                        <span>Pagué Yo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPagadoPorId(integrantes[1]?.id || 'pareja')}
                        className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-[14px] font-bold transition-all ${
                          pagadoPorId !== 'yo'
                            ? 'bg-[var(--fin-ink)] text-[var(--fin-bg)] shadow-xs'
                            : 'bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]'
                        }`}
                      >
                        <span>👩🏼</span>
                        <span>Pagó {nombreOtro}</span>
                      </button>
                    </div>
                  </div>

                  {pagadoPorId === 'yo' && (
                    <label className="flex items-center gap-2 mt-1 text-[13px] text-[var(--fin-ink)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={guardarEnPersonal}
                        onChange={(e) => setGuardarEnPersonal(e.target.checked)}
                        className="rounded accent-[var(--fin-ink)]"
                      />
                      <span>Anotar mi mitad en mis gastos personales de LukApp</span>
                    </label>
                  )}

                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setModalGastoAbierto(false)}
                      className="px-4 py-2 text-[13.5px] font-semibold text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]"
                    >
                      Cancelar
                    </button>
                    <RippleButton
                      type="submit"
                      className="rounded-full bg-[var(--fin-ink)] text-[var(--fin-bg)] px-5 py-2.5 text-[14px] font-bold shadow-md hover:opacity-90"
                    >
                      Guardar gasto
                    </RippleButton>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Crear Nuevo Espacio */}
        <AnimatePresence>
          {modalNuevoEspacioAbierto && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-2xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[var(--fin-line)]/50">
                  <h3 className="text-[17px] font-bold text-[var(--fin-ink)]">
                    Crear Espacio Compartido
                  </h3>
                  <button
                    type="button"
                    onClick={() => setModalNuevoEspacioAbierto(false)}
                    className="p-1 text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleCrearEspacio} className="mt-4 flex flex-col gap-3.5">
                  <div>
                    <label className="text-[12px] font-semibold text-[var(--fin-ink-soft)] uppercase tracking-wider">
                      Nombre del espacio
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Viaje a Cancún, Arriendo, Cenas..."
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      required
                      autoFocus
                      className="mt-1 w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-[16px] text-[var(--fin-ink)] focus:outline-hidden focus:ring-2 focus:ring-[var(--fin-ink)]"
                    />
                  </div>

                  <div>
                    <label className="text-[12px] font-semibold text-[var(--fin-ink-soft)] uppercase tracking-wider">
                      Icono
                    </label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {EMOJIS_ESPACIO.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setNuevoIcono(emoji)}
                          className={`h-9 w-9 flex items-center justify-center rounded-xl text-[18px] transition-transform ${
                            nuevoIcono === emoji
                              ? 'bg-[var(--fin-ink)] scale-110 shadow-sm'
                              : 'bg-[var(--fin-soft)] hover:bg-[var(--fin-card)]'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] font-semibold text-[var(--fin-ink-soft)] uppercase tracking-wider">
                      Nombre de tu compañero/a o pareja
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Camila, Andrés, Mamá..."
                      value={nombrePareja}
                      onChange={(e) => setNombrePareja(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-[16px] text-[var(--fin-ink)] focus:outline-hidden focus:ring-2 focus:ring-[var(--fin-ink)]"
                    />
                  </div>

                  <div>
                    <label className="text-[12px] font-semibold text-[var(--fin-ink-soft)] uppercase tracking-wider">
                      Avatar de tu compañero/a
                    </label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {EMOJIS_PAREJA.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setEmojiPareja(emoji)}
                          className={`h-9 w-9 flex items-center justify-center rounded-xl text-[18px] transition-transform ${
                            emojiPareja === emoji
                              ? 'bg-[var(--fin-ink)] scale-110 shadow-sm'
                              : 'bg-[var(--fin-soft)] hover:bg-[var(--fin-card)]'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setModalNuevoEspacioAbierto(false)}
                      className="px-4 py-2 text-[13.5px] font-semibold text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]"
                    >
                      Cancelar
                    </button>
                    <RippleButton
                      type="submit"
                      className="rounded-full bg-[var(--fin-ink)] text-[var(--fin-bg)] px-5 py-2.5 text-[14px] font-bold shadow-md hover:opacity-90"
                    >
                      Crear espacio
                    </RippleButton>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
