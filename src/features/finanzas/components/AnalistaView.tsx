import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FileUp, KeyRound, Loader2, RotateCcw } from 'lucide-react';
import type { Transaction } from '../types';
import { formatCop } from '../lib/formatCop';
import { planearImportacion } from '../analista/aMovimientos';
import { useAnalista } from '../analista/useAnalista';
import { AnalistaReporte } from './AnalistaReporte';

interface AnalistaViewProps {
  existentes: readonly Transaction[];
  onImportar: (nuevos: Transaction[]) => void;
}

const nuevoId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tx-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

export const AnalistaView: React.FC<AnalistaViewProps> = ({ existentes, onImportar }) => {
  const analista = useAnalista();
  const [tokenBorrador, setTokenBorrador] = useState('');
  const [importado, setImportado] = useState(0);
  const inputArchivo = useRef<HTMLInputElement>(null);

  const plan = useMemo(
    () =>
      analista.resultado
        ? planearImportacion(analista.resultado.movimientos, existentes, nuevoId)
        : null,
    [analista.resultado, existentes],
  );

  // ---------- Token gate ----------
  if (!analista.token) {
    return (
      <div className="mx-auto max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            analista.guardarToken(tokenBorrador);
          }}
          className="rounded-3xl border border-[#ede9e3] bg-white p-6 text-center"
        >
          <span className="fin-emoji block text-4xl" aria-hidden="true">
            🔐
          </span>
          <h2 className="mt-3 text-lg font-extrabold tracking-tight">Token de acceso</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-[#78716c]">
            Cada análisis gasta dinero de tu cuenta de Anthropic, así que el endpoint pide un
            token. Pégalo una vez y queda guardado en este dispositivo.
          </p>

          <input
            type="password"
            value={tokenBorrador}
            onChange={(e) => setTokenBorrador(e.target.value)}
            autoComplete="current-password"
            placeholder="ANALISTA_TOKEN"
            className="mt-5 w-full rounded-2xl border-2 border-[#ede9e3] bg-[#fbf9f6] px-4 py-3 text-center text-base font-medium focus:border-[#a8a29e] focus:outline-none"
            aria-label="Token de acceso"
          />

          <button
            type="submit"
            disabled={!tokenBorrador.trim()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#1c1917] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#292524] disabled:opacity-30"
          >
            <KeyRound className="h-4 w-4" strokeWidth={3} />
            Guardar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      {/* ---------- Upload ---------- */}
      {analista.fase === 'inactivo' || analista.fase === 'error' ? (
        <section className="rounded-3xl border-2 border-dashed border-[#ede9e3] bg-white px-6 py-9 text-center">
          <span className="fin-emoji block text-4xl" aria-hidden="true">
            📄
          </span>
          <h2 className="mt-3 text-lg font-extrabold tracking-tight">Sube tu extracto</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-[#78716c]">
            PDF de tu banco, hasta 6 MB. Se leen los movimientos, se clasifican, y decides qué
            importar a tu historial.
          </p>

          <input
            ref={inputArchivo}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) {
                setImportado(0);
                analista.analizar(archivo);
              }
              // Reset so picking the same file twice still fires onChange.
              e.target.value = '';
            }}
          />

          <motion.button
            type="button"
            onClick={() => inputArchivo.current?.click()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#1c1917] px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#292524]"
          >
            <FileUp className="h-4 w-4" strokeWidth={3} />
            Elegir PDF
          </motion.button>

          <p className="mt-4 text-[11px] text-[#a8a29e]">Cuesta entre USD 0,20 y 0,50 por análisis.</p>
        </section>
      ) : null}

      {/* ---------- Error ---------- */}
      {analista.fase === 'error' && analista.error ? (
        <section className="rounded-3xl bg-[#fff1f2] p-5">
          <p className="flex items-center gap-2 text-[13px] font-extrabold text-[#be123c]">
            <span className="fin-emoji" aria-hidden="true">
              ❌
            </span>
            No se pudo analizar
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[#be123c]">
            {analista.error.mensaje}
          </p>

          {analista.error.codigo === 'sin-autorizacion' ? (
            <button
              type="button"
              onClick={() => analista.guardarToken('')}
              className="mt-3 rounded-full bg-white px-4 py-2 text-[11px] font-bold text-[#be123c]"
            >
              Cambiar el token
            </button>
          ) : null}
        </section>
      ) : null}

      {/* ---------- Working ---------- */}
      {analista.fase === 'subiendo' || analista.fase === 'procesando' ? (
        <section className="rounded-3xl border border-[#ede9e3] bg-white px-6 py-10 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#a8a29e]" strokeWidth={3} />
          <p className="mt-4 text-sm font-extrabold">
            {analista.fase === 'subiendo' ? 'Subiendo el PDF…' : 'Leyendo tu extracto…'}
          </p>
          <p className="mt-1 text-[12px] text-[#78716c]">
            {analista.fase === 'procesando'
              ? `Puede tardar varios minutos. Van ${analista.segundos}s.`
              : 'Un momento.'}
          </p>
        </section>
      ) : null}

      {/* ---------- Result ---------- */}
      {analista.fase === 'listo' && analista.resultado && plan ? (
        <>
          <section className="rounded-3xl border border-[#ede9e3] bg-white p-5">
            <h2 className="text-xs font-bold text-[#78716c]">⬇️ Importar a tu historial</h2>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Nuevos', n: plan.nuevos.length, ink: '#15803d' },
                { label: 'Ya estaban', n: plan.duplicados.length, ink: '#78716c' },
                { label: 'No cuentan', n: plan.excluidos.length, ink: '#a16207' },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl bg-[#f5f3f0] px-2 py-3">
                  <p className="text-xl font-extrabold tabular-nums" style={{ color: c.ink }}>
                    {c.n}
                  </p>
                  <p className="text-[10px] font-bold text-[#78716c]">{c.label}</p>
                </div>
              ))}
            </div>

            {importado > 0 ? (
              <p className="mt-3 rounded-2xl bg-[#f0fdf4] px-4 py-3 text-[12px] font-bold text-[#15803d]">
                <span className="fin-emoji mr-1" aria-hidden="true">
                  ✅
                </span>
                Importaste {importado} movimiento{importado === 1 ? '' : 's'}.
              </p>
            ) : (
              <button
                type="button"
                disabled={plan.nuevos.length === 0}
                onClick={() => {
                  onImportar(plan.nuevos);
                  setImportado(plan.nuevos.length);
                }}
                className="mt-3 w-full rounded-full bg-[#1c1917] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#292524] disabled:opacity-30"
              >
                {plan.nuevos.length === 0
                  ? 'Nada nuevo por importar'
                  : `Importar ${plan.nuevos.length} movimiento${plan.nuevos.length === 1 ? '' : 's'}`}
              </button>
            )}

            {plan.duplicados.length > 0 ? (
              <p className="mt-2.5 text-[11px] leading-relaxed text-[#a8a29e]">
                {plan.duplicados.length} ya estaban en tu historial y no se van a duplicar
                {plan.nuevos.length > 0
                  ? `. Los nuevos suman ${formatCop(
                      plan.nuevos.reduce((s, tx) => s + tx.amountCop, 0),
                    )}.`
                  : '.'}
              </p>
            ) : null}
          </section>

          <AnalistaReporte resultado={analista.resultado} uso={analista.uso} />

          <button
            type="button"
            onClick={() => {
              setImportado(0);
              analista.reiniciar();
            }}
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#ede9e3] bg-white px-5 py-2.5 text-[12px] font-bold text-[#78716c] transition-colors hover:text-[#1c1917]"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={3} />
            Analizar otro extracto
          </button>
        </>
      ) : null}
    </div>
  );
};
