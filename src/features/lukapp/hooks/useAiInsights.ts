import { useState, useEffect, useMemo, useRef } from 'react';
import type { Transaction, CategoriaClave } from '../types';
import type { Presupuesto } from '../lib/presupuestos';
import { insightsDelMes, type Insight } from '../lib/insights';
import { bogotaDate } from '../lib/localDate';
import { PERIODO_POR_DEFECTO, type ConfigPeriodo } from '../lib/periodo';
import { apiUrl } from '../../../lib/api';
import { obtenerSupabase } from '../data/supabase';

interface UseAiInsightsOptions {
  transacciones: readonly Transaction[];
  presupuestos: readonly Presupuesto[];
  /** Mes calendario real ('YYYY-MM') -- los insights que comparan "este mes"
   * contra meses previos se quedan siempre en calendario, sin importar el
   * período que el usuario haya elegido en Ajustes (ver el comentario de
   * `insightsDelMes` en lib/insights.ts). */
  mesCalendario: string;
  nombreDe: (categoria: CategoriaClave) => string;
  /** El período real elegido en Ajustes, y su umbral de alerta -- solo los usa
   * el aviso de presupuesto, para que el número que muestra coincida con el
   * que ves en la pantalla de Presupuestos. */
  configPeriodo?: ConfigPeriodo;
  umbralAlertaPct?: number;
}

export const useAiInsights = ({
  transacciones,
  presupuestos,
  mesCalendario,
  nombreDe,
  configPeriodo = PERIODO_POR_DEFECTO,
  umbralAlertaPct = 80,
}: UseAiInsightsOptions): {
  insights: Insight[];
  cargandoIa: boolean;
  origenIa: boolean;
  refrescar: () => void;
} => {
  const [aiInsights, setAiInsights] = useState<Insight[]>([]);
  const [cargandoIa, setCargandoIa] = useState(false);
  const [origenIa, setOrigenIa] = useState(false);
  // Hasta comprobar el plan no se envía ningún dato al generador de insights.
  // Normal conserva sus avisos locales; los análisis mensuales por IA son
  // exclusivamente de Premium.
  const [tienePremium, setTienePremium] = useState<boolean | null>(null);
  const lastFetchKey = useRef<string>('');

  // 1. Insights deterministas locales inmediatos (garantía offline / sin demora)
  const localInsights = useMemo(
    () =>
      insightsDelMes(
        transacciones,
        presupuestos,
        mesCalendario,
        bogotaDate(),
        nombreDe,
        configPeriodo,
        umbralAlertaPct,
      ),
    [transacciones, presupuestos, mesCalendario, nombreDe, configPeriodo, umbralAlertaPct],
  );

  useEffect(() => {
    let cancelado = false;

    const consultarPlan = async () => {
      const cliente = obtenerSupabase();
      if (!cliente) {
        if (!cancelado) setTienePremium(false);
        return;
      }

      try {
        const sesion = (await cliente.auth.getSession()).data.session;
        if (!sesion?.access_token) {
          if (!cancelado) setTienePremium(false);
          return;
        }

        const respuesta = await fetch(apiUrl('/api/mi-plan'), {
          headers: { Authorization: `Bearer ${sesion.access_token}` },
        });
        const plan = await respuesta.json().catch(() => ({})) as { codigo?: unknown };
        if (!cancelado) setTienePremium(respuesta.ok && plan.codigo === 'premium');
      } catch {
        // Si no se puede comprobar el plan, no se arriesga una llamada a IA.
        if (!cancelado) setTienePremium(false);
      }
    };

    void consultarPlan();
    return () => {
      cancelado = true;
    };
  }, []);

  const fetchAiInsights = async () => {
    // Si no hay plan Premium comprobado, no gastar llamadas al modelo.
    if (tienePremium !== true) {
      setAiInsights([]);
      setOrigenIa(false);
      setCargandoIa(false);
      return;
    }

    const currentKey = `${mesCalendario}-${transacciones.length}`;
    if (currentKey === lastFetchKey.current) return;
    lastFetchKey.current = currentKey;

    setCargandoIa(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const cliente = obtenerSupabase();
      if (cliente) {
        const session = (await cliente.auth.getSession()).data.session;
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
      }

      const res = await fetch(apiUrl('/api/finanzas-insights-ia'), {
        method: 'POST',
        headers,
        // El servidor arma el perfil desde la cuenta autenticada. El cliente
        // no manda cifras ni puede pedir datos de otra persona.
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.insights) && data.insights.length > 0) {
          setAiInsights(data.insights);
          setOrigenIa(true);
        } else {
          setOrigenIa(false);
        }
      } else {
        setOrigenIa(false);
      }
    } catch (error) {
      console.warn('[useAiInsights] No se pudieron cargar insights IA, usando heurísticos locales:', error);
      setOrigenIa(false);
    } finally {
      setCargandoIa(false);
    }
  };

  useEffect(() => {
    fetchAiInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesCalendario, transacciones.length, tienePremium]);

  // Si hay insights de IA, mostrarlos. Si no, o como complemento, usar los locales.
  const insightsCombinados = useMemo(() => {
    if (aiInsights.length > 0) {
      return aiInsights;
    }
    return localInsights;
  }, [aiInsights, localInsights]);

  return {
    insights: insightsCombinados,
    cargandoIa,
    origenIa,
    refrescar: () => {
      lastFetchKey.current = '';
      fetchAiInsights();
    },
  };
};
