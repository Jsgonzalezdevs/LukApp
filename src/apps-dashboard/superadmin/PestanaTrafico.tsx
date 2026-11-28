import React from 'react';
import {
  Loader2,
  BarChart3,
  Globe,
  Monitor,
  Link2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { RANGOS, ICONO_DISPOSITIVO, NOMBRE_DISPOSITIVO, safeNum } from './formato';
import { GraficaBarrasUnificada } from './GraficaBarrasUnificada';
import { type VisitasAdmin } from './visitas';
import { banderaDePais, nombreDePais } from '../estadisticas';

export const PestanaTrafico: React.FC<{ v: VisitasAdmin }> = ({ v }) => {
  const { rangoVisitantes, setRangoVisitantes, loadingVisitas, visitasHoy, loadingVisitasHoy, errorVisitas, fetchVisitasHoy, resumenVisitas, itemsDia, itemsHora } = v;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Analítica de tráfico</h2>
          <p className="mt-1 text-xs text-[var(--fin-ink-soft)]">
            Quién visita tu sitio de LukApp, de dónde vienen y a qué horas, 100% privado y sin cookies.
          </p>
        </div>

        <div className="flex gap-1 rounded-xl bg-[var(--fin-soft)] p-1">
          {RANGOS.map((r) => (
            <button
              key={r.dias}
              type="button"
              onClick={() => setRangoVisitantes(r.dias)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                rangoVisitantes === r.dias
                  ? 'bg-[var(--fin-card)] text-[var(--fin-ink)] shadow-sm'
                  : 'text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]'
              }`}
            >
              {r.texto}
            </button>
          ))}
        </div>
      </div>

      {loadingVisitas ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
        </div>
      ) : (
        <>
          {errorVisitas && (
            <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">
              {errorVisitas}
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                Páginas vistas
              </p>
              <p className="mt-2 text-4xl font-extrabold tabular-nums tracking-tight">
                {safeNum(resumenVisitas.vistas)}
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                Visitantes por día, sumados
              </p>
              <p className="mt-2 text-4xl font-extrabold tabular-nums tracking-tight">
                {safeNum(resumenVisitas.visitantes)}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--fin-ink-faint)]">
                El identificador rota cada medianoche para garantizar privacidad absoluta.
              </p>
            </div>
          </div>

          {/* Tabla en vivo de hoy */}
          <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Datos en vivo de hoy
                </h3>
                <p className="text-[10px] text-[var(--fin-ink-faint)] mt-1">Se actualiza cada consulta (cada minuto en el panel)</p>
              </div>
              <button
                onClick={fetchVisitasHoy}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--fin-line)] bg-[var(--fin-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)] transition-colors"
                disabled={loadingVisitasHoy}
              >
                <RefreshCw className={`h-3 w-3 ${loadingVisitasHoy ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>

            {loadingVisitasHoy && !visitasHoy ? (
              <div className="flex h-20 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--fin-ink-faint)]" />
              </div>
            ) : visitasHoy ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--fin-soft)]/50">
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3 text-right">Visitas de hoy</th>
                      <th className="px-4 py-3 text-right">Visitantes únicos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--fin-line)]">
                    <tr className="hover:bg-[var(--fin-soft)]/30 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-[var(--fin-ink)]">
                        {new Date(visitasHoy.fecha + 'T00:00:00').toLocaleDateString('es-CO', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/15 px-2.5 py-1 font-bold text-sky-600 dark:text-sky-400">
                          {safeNum(visitasHoy.visitas_hoy)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 font-bold text-emerald-600 dark:text-emerald-400">
                          {safeNum(visitasHoy.unicos_hoy)}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-[var(--fin-ink-faint)]">No hay datos en vivo disponibles aún.</p>
            )}
          </div>

          {/* Gráfica Día a Día (Estilo Unificado) */}
          <GraficaBarrasUnificada
            titulo="Tráfico Día a Día"
            subtitulo={`Últimos ${rangoVisitantes} días en horario local`}
            icono={<BarChart3 className="h-3.5 w-3.5 text-sky-500" />}
            items={itemsDia}
            vacio="Todavía no hay visitas en este rango."
          />

          {/* Gráfica Horas Pico de Tráfico (Mismo Estilo Unificado) */}
          <GraficaBarrasUnificada
            titulo="Horas Pico de Tráfico"
            subtitulo="Distribución horaria (Hora Colombia UTC-5)"
            icono={<Clock className="h-3.5 w-3.5 text-sky-500" />}
            items={itemsHora}
            vacio="Sin visitas registradas."
            pieDeGrafica={
              <div className="flex justify-between text-[10px] font-semibold text-[var(--fin-ink-faint)] mt-2.5 px-1">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00 m.</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            }
          />

          {/* Tablas de Desglose */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Qué Miran */}
            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
              <h3 className="mb-4 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                <span className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5" /> Qué miran (Rutas)</span>
                <span className="text-[10px] text-[var(--fin-ink-faint)]">{resumenVisitas.rutas.length} páginas</span>
              </h3>
              <ul className="flex flex-col gap-2.5">
                {resumenVisitas.rutas.slice(0, 8).map((r) => {
                  const pct = resumenVisitas.vistas > 0 ? Math.round((r.n / resumenVisitas.vistas) * 100) : 0;
                  return (
                    <li key={r.clave} className="flex items-center justify-between rounded-xl bg-[var(--fin-soft)] px-3 py-2 text-xs">
                      <span className="font-medium truncate">{r.clave}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{pct}%</span>
                        <span className="font-bold tabular-nums">{r.n}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* De Dónde Son */}
            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
              <h3 className="mb-4 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> De dónde son (Países)</span>
                <span className="text-[10px] text-[var(--fin-ink-faint)]">{resumenVisitas.paises.length} países</span>
              </h3>
              <ul className="flex flex-col gap-2.5">
                {resumenVisitas.paises.slice(0, 8).map((p) => {
                  const pct = resumenVisitas.vistas > 0 ? Math.round((p.n / resumenVisitas.vistas) * 100) : 0;
                  return (
                    <li key={p.clave} className="flex items-center justify-between rounded-xl bg-[var(--fin-soft)] px-3 py-2 text-xs">
                      <span className="font-medium">{banderaDePais(p.clave)} {nombreDePais(p.clave)}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{pct}%</span>
                        <span className="font-bold tabular-nums">{p.n}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Fuentes de Tráfico */}
            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
              <h3 className="mb-4 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                <span className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5" /> Fuentes de Tráfico</span>
                <span className="text-[10px] text-[var(--fin-ink-faint)]">{resumenVisitas.fuentes.length} fuentes</span>
              </h3>
              <ul className="flex flex-col gap-2.5">
                {resumenVisitas.fuentes.slice(0, 8).map((f) => {
                  const pct = resumenVisitas.vistas > 0 ? Math.round((f.n / resumenVisitas.vistas) * 100) : 0;
                  return (
                    <li key={f.clave} className="flex items-center justify-between rounded-xl bg-[var(--fin-soft)] px-3 py-2 text-xs">
                      <span className="font-medium truncate">{f.clave}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{pct}%</span>
                        <span className="font-bold tabular-nums">{f.n}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Dispositivos */}
            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
              <h3 className="mb-4 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                <span className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5" /> Dispositivos</span>
                <span className="text-[10px] text-[var(--fin-ink-faint)]">{resumenVisitas.dispositivos.length} tipos</span>
              </h3>
              <ul className="flex flex-col gap-2.5">
                {resumenVisitas.dispositivos.map((d) => {
                  const pct = resumenVisitas.vistas > 0 ? Math.round((d.n / resumenVisitas.vistas) * 100) : 0;
                  return (
                    <li key={d.clave} className="flex items-center justify-between rounded-xl bg-[var(--fin-soft)] px-3 py-2 text-xs">
                      <span className="font-medium flex items-center gap-2">
                        {ICONO_DISPOSITIVO[d.clave]} {NOMBRE_DISPOSITIVO[d.clave] ?? d.clave}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{pct}%</span>
                        <span className="font-bold tabular-nums">{d.n}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
              <h3 className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                <Link2 className="h-3.5 w-3.5" /> Fuente / medio UTM
              </h3>
              <p className="mb-4 text-[10px] text-[var(--fin-ink-faint)]">Atribución declarada en tus enlaces de campaña.</p>
              {resumenVisitas.atribuciones.length === 0 ? (
                <p className="py-4 text-xs text-[var(--fin-ink-faint)]">Aún no hay enlaces con UTM.</p>
              ) : <ul className="flex flex-col gap-2.5">
                {resumenVisitas.atribuciones.slice(0, 6).map((dato) => (
                  <li key={dato.clave} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--fin-soft)] px-3 py-2 text-xs">
                    <span className="truncate font-medium">{dato.clave}</span><span className="font-bold tabular-nums">{dato.n}</span>
                  </li>
                ))}
              </ul>}
            </div>

            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
              <h3 className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                <BarChart3 className="h-3.5 w-3.5" /> Campañas UTM
              </h3>
              <p className="mb-4 text-[10px] text-[var(--fin-ink-faint)]">Qué campaña está generando visitas.</p>
              {resumenVisitas.campanas.length === 0 ? (
                <p className="py-4 text-xs text-[var(--fin-ink-faint)]">Agrega <code>utm_campaign</code> a tus enlaces.</p>
              ) : <ul className="flex flex-col gap-2.5">
                {resumenVisitas.campanas.slice(0, 6).map((dato) => (
                  <li key={dato.clave} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--fin-soft)] px-3 py-2 text-xs">
                    <span className="truncate font-medium">{dato.clave}</span><span className="font-bold tabular-nums">{dato.n}</span>
                  </li>
                ))}
              </ul>}
            </div>

            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
              <h3 className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                <Globe className="h-3.5 w-3.5" /> Referentes exactos
              </h3>
              <p className="mb-4 text-[10px] text-[var(--fin-ink-faint)]">Dominio que envió la visita; no guardamos URL privada.</p>
              <ul className="flex flex-col gap-2.5">
                {resumenVisitas.referentes.slice(0, 6).map((dato) => (
                  <li key={dato.clave} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--fin-soft)] px-3 py-2 text-xs">
                    <span className="truncate font-medium">{dato.clave}</span><span className="font-bold tabular-nums">{dato.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {[
              ['Navegadores', resumenVisitas.navegadores],
              ['Sistemas operativos', resumenVisitas.sistemas],
              ['Idiomas del navegador', resumenVisitas.idiomas],
            ].map(([titulo, filas]) => (
              <div key={titulo as string} className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
                <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">{titulo as string}</h3>
                <p className="mb-4 text-[10px] text-[var(--fin-ink-faint)]">Sólo de personas que aceptaron analítica detallada.</p>
                {(filas as import('../estadisticas').Conteo[]).length === 0 ? <p className="py-4 text-xs text-[var(--fin-ink-faint)]">Sin consentimientos aún.</p> : <ul className="flex flex-col gap-2.5">{(filas as import('../estadisticas').Conteo[]).slice(0, 6).map((dato) => <li key={dato.clave} className="flex items-center justify-between rounded-xl bg-[var(--fin-soft)] px-3 py-2 text-xs"><span className="font-medium">{dato.clave}</span><span className="font-bold tabular-nums">{dato.n}</span></li>)}</ul>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
