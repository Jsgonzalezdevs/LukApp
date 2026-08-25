import { useState, useEffect, useMemo, useRef } from 'react';
import type { Transaction, CategoriaClave } from '../types';
import type { Presupuesto } from '../lib/presupuestos';
import type { Cajita, CajitaMovimiento } from '../data/modelos';
import { insightsDelMes, type Insight } from '../lib/insights';
import { bogotaDate, monthKey } from '../lib/localDate';
import { PERIODO_POR_DEFECTO, type ConfigPeriodo } from '../lib/periodo';
import { saldoEfectivo, saldoCuentasSinEfectivo, totalVisible } from '../lib/cajitas';
import { apiUrl } from '../../../lib/api';
import { obtenerSupabase } from '../data/supabase';

interface UseAiInsightsOptions {
  transacciones: readonly Transaction[];
  presupuestos: readonly Presupuesto[];
  cajitas: readonly Cajita[];
  cajitaMovimientos: readonly CajitaMovimiento[];
  /** Mes calendario real ('YYYY-MM') -- los insights que comparan "este mes"
   * contra meses previos se quedan siempre en calendario, sin importar el
   * período que el usuario haya elegido en Ajustes (ver el comentario de
   * `insightsDelMes` en lib/insights.ts). */
  mesCalendario: string;
  nombreDe: (categoria: CategoriaClave) => string;
  mostrarAhorro?: boolean;
  /** El período real elegido en Ajustes, y su umbral de alerta -- solo los usa
   * el aviso de presupuesto, para que el número que muestra coincida con el
   * que ves en la pantalla de Presupuestos. */
  configPeriodo?: ConfigPeriodo;
  umbralAlertaPct?: number;
}

export const useAiInsights = ({
  transacciones,
  presupuestos,
  cajitas,
  cajitaMovimientos,
  mesCalendario,
  nombreDe,
  mostrarAhorro = true,
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

  // Contexto numérico resumido para enviar a Grok/Groq
  const finanzasContext = useMemo(() => {
    const txMes = transacciones.filter((t) => monthKey(t.occurredOn) === mesCalendario);
    const gastosMes = txMes
      .filter((t) => t.kind === 'gasto')
      .reduce((sum, t) => sum + t.amountCop, 0);
    const ingresosMes = txMes
      .filter((t) => t.kind === 'ingreso')
      .reduce((sum, t) => sum + t.amountCop, 0);

    const chiquitos = txMes.filter((t) => t.kind === 'gasto' && t.amountCop < 10_000);
    const totalChiquitos = chiquitos.reduce((sum, t) => sum + t.amountCop, 0);

    const efectivo = saldoEfectivo(cajitas, cajitaMovimientos, transacciones);
    const bancos = saldoCuentasSinEfectivo(cajitas, cajitaMovimientos, transacciones);
    const patrimonio = totalVisible(cajitas, cajitaMovimientos, transacciones, mostrarAhorro);

    // Top 3 categorías de gasto
    const porCat = new Map<string, number>();
    for (const t of txMes.filter((t) => t.kind === 'gasto')) {
      const nombre = nombreDe(t.category);
      porCat.set(nombre, (porCat.get(nombre) || 0) + t.amountCop);
    }
    const topCategorias = [...porCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, total]) => ({ categoria: cat, totalCop: total }));

    return {
      mes: mesCalendario,
      patrimonioTotalCop: patrimonio,
      saldoBancosCop: bancos,
      saldoEfectivoCop: efectivo,
      gastosMesCop: gastosMes,
      ingresosMesCop: ingresosMes,
      tasaAhorroPct: ingresosMes > 0 ? Math.round(((ingresosMes - gastosMes) / ingresosMes) * 100) : 0,
      totalComprasChiquitasCop: totalChiquitos,
      conteoComprasChiquitas: chiquitos.length,
      topCategoriasGasto: topCategorias,
      totalTransaccionesMes: txMes.length,
    };
  }, [transacciones, cajitas, cajitaMovimientos, mesCalendario, nombreDe, mostrarAhorro]);

  const fetchAiInsights = async () => {
    // Si no hay transacciones en el mes, no gastar llamadas al modelo
    if (finanzasContext.totalTransaccionesMes === 0) {
      setAiInsights([]);
      setOrigenIa(false);
      return;
    }

    const currentKey = `${mesCalendario}-${transacciones.length}-${finanzasContext.gastosMesCop}-${finanzasContext.ingresosMesCop}`;
    if (currentKey === lastFetchKey.current) return;
    lastFetchKey.current = currentKey;

    // Revisar caché en sessionStorage (20 minutos)
    const cacheKey = `lukapp_ai_insights_${mesCalendario}_${transacciones.length}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && Date.now() - parsed.timestamp < 20 * 60 * 1000 && Array.isArray(parsed.insights)) {
          setAiInsights(parsed.insights);
          setOrigenIa(true);
          return;
        }
      }
    } catch {
      // Ignorar errores de sessionStorage
    }

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
        body: JSON.stringify({ finanzasContext }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.insights) && data.insights.length > 0) {
          setAiInsights(data.insights);
          setOrigenIa(true);

          try {
            sessionStorage.setItem(
              cacheKey,
              JSON.stringify({ timestamp: Date.now(), insights: data.insights }),
            );
          } catch {
            // Ignorar
          }
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
  }, [mesCalendario, transacciones.length]);

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
