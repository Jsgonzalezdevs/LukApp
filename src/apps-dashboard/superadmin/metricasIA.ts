/**
 * Monitor de IA & Tokens y la consulta abierta en detalle.
 *
 * Solo estado y manejadores: los efectos que cargan datos siguen en
 * SuperadminPanel, en su orden original, para no cambiar cuándo se piden.
 */
import { useState } from 'react';
import { type PeticionIA, type MetricasIAResponse } from './tipos';
import { tokenSesion } from './sesion';
import { apiUrl } from '../../lib/api';

export const useMetricasIAAdmin = () => {
  // --- IA & Tokens State ---
  const [metricasIA, setMetricasIA] = useState<MetricasIAResponse | null>(null);
  const [loadingMetricasIA, setLoadingMetricasIA] = useState(false);

  // --- Consulta Detalle Modal ---
  const [consultaDetalle, setConsultaDetalle] = useState<PeticionIA | null>(null);

  // 3. Cargar Métricas de IA & Tokens
  const fetchMetricasIA = async () => {
    setLoadingMetricasIA(true);
    try {
      const token = await tokenSesion();
      const res = await fetch(apiUrl('/api/metricas-ia'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const numeroONulo = (valor: unknown): number | null => {
          if (valor === null || valor === undefined || valor === '') return null;
          const numero = Number(valor);
          return Number.isFinite(numero) ? numero : null;
        };
        // Sanear campos numéricos: si el servidor devuelve null en cualquier
        // campo numérico (p.ej. cuando no hay llamadas registradas todavía),
        // `null.toLocaleString()` explota en el render con un TypeError.
        // Coercionar a 0 es correcto: 0 tokens usados = no se usó nada.
        const sano: MetricasIAResponse = {
          ...data,
          tokensHoy:              Number(data.tokensHoy)              || 0,
          limiteTokensDiariosReferencia: numeroONulo(data.limiteTokensDiariosReferencia),
          llamadasHoy:            Number(data.llamadasHoy)            || 0,
          llamadasExitosas:       Number(data.llamadasExitosas)       || 0,
          llamadasFallback:       Number(data.llamadasFallback)       || 0,
          limiteTokensProveedorMinuto: numeroONulo(data.limiteTokensProveedorMinuto),
          tokensProveedorRestantesMinuto: numeroONulo(data.tokensProveedorRestantesMinuto),
          limiteSolicitudesProveedorDia: numeroONulo(data.limiteSolicitudesProveedorDia),
          solicitudesProveedorRestantesDia: numeroONulo(data.solicitudesProveedorRestantesDia),
          porcentajeCapacidadTokens: numeroONulo(data.porcentajeCapacidadTokens),
          cuotaProveedorObservadaEn: typeof data.cuotaProveedorObservadaEn === 'string' ? data.cuotaProveedorObservadaEn : null,
          latenciaPromedioMs:     Number(data.latenciaPromedioMs)     || 0,
          costoEstimadoCop:       Number(data.costoEstimadoCop)       || 0,
          origenMetricas:         data.origenMetricas === 'supabase' ? 'supabase' : 'memoria',
          diagnosticoTelemetria:  typeof data.diagnosticoTelemetria === 'string' ? data.diagnosticoTelemetria : null,
          peticionesRecientes:    Array.isArray(data.peticionesRecientes) ? data.peticionesRecientes : [],
          consumoPorUsuario:      Array.isArray(data.consumoPorUsuario) ? data.consumoPorUsuario : [],
        };
        setMetricasIA(sano);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMetricasIA(false);
    }
  };

  return {
    metricasIA,
    setMetricasIA,
    loadingMetricasIA,
    setLoadingMetricasIA,
    consultaDetalle,
    setConsultaDetalle,
    fetchMetricasIA,
  };
};

export type MetricasIAAdmin = ReturnType<typeof useMetricasIAAdmin>;
