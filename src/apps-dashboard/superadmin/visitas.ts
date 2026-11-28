/**
 * Analítica de tráfico: rango, visitas, datos de hoy y series para las gráficas.
 *
 * Solo estado y manejadores: los efectos que cargan datos siguen en
 * SuperadminPanel, en su orden original, para no cambiar cuándo se piden.
 */
import { useState, useCallback, useMemo } from 'react';
import { type BarraItem } from './tipos';
import { formatearFechaCorta } from './formato';
import { tokenSesion } from './sesion';
import { apiUrl } from '../../lib/api';
import type { Visita } from '../estadisticas';
import { diasHasta, resumir } from '../estadisticas';

export const useVisitasAdmin = () => {
  // --- Visitantes State ---
  const [rangoVisitantes, setRangoVisitantes] = useState(30);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loadingVisitas, setLoadingVisitas] = useState(false);
  const [visitasHoy, setVisitasHoy] = useState<{ fecha: string; visitas_hoy: number; unicos_hoy: number } | null>(null);
  const [loadingVisitasHoy, setLoadingVisitasHoy] = useState(false);
  const [errorVisitas, setErrorVisitas] = useState<string | null>(null);

  const dias = useMemo(() => diasHasta(new Date(), rangoVisitantes), [rangoVisitantes]);

  // La API valida el permiso antes de usar su cliente de servidor. Centralizar
  // esta lectura evita que una migración o la caché de PostgREST convierta un
  // fallo real en contadores vacíos sin explicación dentro del panel.
  const cargarVisitas = useCallback(async (soloActualizar: boolean) => {
    if (soloActualizar) setLoadingVisitasHoy(true);
    else setLoadingVisitas(true);
    setErrorVisitas(null);
    try {
      const token = await tokenSesion();
      const res = await fetch(apiUrl(`/api/superadmin/visitas?dias=${rangoVisitantes}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar la analítica de tráfico.');

      setVisitas((data.visitas || []) as Visita[]);
      setVisitasHoy({
        fecha: data.hoy?.fecha ?? '',
        visitas_hoy: Number(data.hoy?.visitas_hoy) || 0,
        unicos_hoy: Number(data.hoy?.unicos_hoy) || 0,
      });
    } catch (error) {
      console.error('Error cargando analítica de tráfico:', error);
      setErrorVisitas(error instanceof Error ? error.message : 'No se pudo cargar la analítica de tráfico.');
    } finally {
      if (soloActualizar) setLoadingVisitasHoy(false);
      else setLoadingVisitas(false);
    }
  }, [rangoVisitantes]);

  const fetchVisitas = useCallback(() => cargarVisitas(false), [cargarVisitas]);
  const fetchVisitasHoy = useCallback(() => cargarVisitas(true), [cargarVisitas]);

  const resumenVisitas = useMemo(() => resumir(visitas, dias), [visitas, dias]);

  const itemsDia: BarraItem[] = useMemo(
    () =>
      resumenVisitas.porDia.map((d) => ({
        id: d.fecha,
        etiqueta: formatearFechaCorta(d.fecha),
        subetiqueta: d.fecha,
        valor: d.vistas,
        secundario: d.visitantes,
      })),
    [resumenVisitas.porDia],
  );

  const itemsHora: BarraItem[] = useMemo(
    () =>
      resumenVisitas.porHora.map((h) => ({
        id: `h-${h.hora}`,
        etiqueta: h.etiqueta,
        valor: h.vistas,
      })),
    [resumenVisitas.porHora],
  );

  return {
    rangoVisitantes,
    setRangoVisitantes,
    visitas,
    setVisitas,
    loadingVisitas,
    setLoadingVisitas,
    visitasHoy,
    setVisitasHoy,
    loadingVisitasHoy,
    setLoadingVisitasHoy,
    errorVisitas,
    setErrorVisitas,
    dias,
    cargarVisitas,
    fetchVisitas,
    fetchVisitasHoy,
    resumenVisitas,
    itemsDia,
    itemsHora,
  };
};

export type VisitasAdmin = ReturnType<typeof useVisitasAdmin>;
