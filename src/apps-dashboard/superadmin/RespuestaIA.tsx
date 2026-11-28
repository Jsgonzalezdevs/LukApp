import React from 'react';
import { RespuestaAsesor } from '../../components/RespuestaAsesor';
import { leerRespuestaVisual } from '../../lib/bloquesAsesor';

interface InsightIA {
  id?: string;
  titulo: string;
  detalle: string;
  tono?: 'neutral' | 'bien' | 'atento';
  seccion?: string | null;
}

/** El punto de color de cada insight, igual al que usa la propia pantalla
 * "Para ti" -- así el admin ve la respuesta tal como la ve el usuario. */
const puntoDeTono = (tono?: string): string =>
  tono === 'atento' ? 'var(--fin-out)' : tono === 'bien' ? 'var(--fin-in)' : 'var(--fin-ink-faint)';

/** Algunas peticiones a la IA (como "Generación de insights IA") no devuelven
 * una respuesta conversacional sino un JSON de tarjetas. Mostrar ese JSON
 * crudo es ilegible; esto lo detecta y lo pinta como las tarjetas que son. */
export const RespuestaIA: React.FC<{ texto: string }> = ({ texto }) => {
  // Las respuestas con bloques visuales se ven igual que en el chat del usuario.
  if (leerRespuestaVisual(texto)) return <RespuestaAsesor texto={texto} />;
  let parsed: unknown;
  try {
    parsed = JSON.parse(texto);
  } catch {
    return <RespuestaAsesor texto={texto} />;
  }

  const esInsight = (v: unknown): v is InsightIA =>
    typeof v === 'object' && v !== null && 'titulo' in v && 'detalle' in v;

  if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(esInsight)) {
    return (
      <div className="flex flex-col gap-2.5">
        {(parsed as InsightIA[]).map((insight, i) => (
          <div
            key={insight.id ?? i}
            className="flex items-start gap-2.5 rounded-xl border border-[var(--fin-line)]/50 bg-[var(--fin-soft)]/40 p-3"
          >
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: puntoDeTono(insight.tono) }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[13px] text-[var(--fin-ink)]">{insight.titulo}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
                {insight.detalle}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // JSON válido pero no del formato de insights: al menos indentarlo para
  // que se pueda leer, en vez de un solo párrafo apretado.
  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-[12px]">
      {JSON.stringify(parsed, null, 2)}
    </pre>
  );
};
