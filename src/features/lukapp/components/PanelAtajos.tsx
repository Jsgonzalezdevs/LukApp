import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Info, KeyRound, Plus, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { apiUrl } from '../../../lib/api';
import { obtenerSupabase } from '../data/supabase';

/** El Atajo publicado en iCloud para registrar movimientos manualmente. */
const URL_ATAJO_ICLOUD = 'https://www.icloud.com/shortcuts/5331c6951e0e411c96a6bf39adaeb95c';

interface LlaveAtajo {
  id: string;
  pista: string;
  etiqueta: string;
  creada_en: string;
  usada_en: string | null;
  revocada_en: string | null;
}

/** Fecha corta, sin hora: es de un vistazo, no un registro exacto. */
const fechaCorta = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

/** El botón de copiar de esta pantalla: mismo icono, mismo aviso de "listo". */
const BotonCopiar: React.FC<{ valor: string; etiqueta: string }> = ({ valor, etiqueta }) => {
  const [copiado, setCopiado] = useState(false);
  const [fallo, setFallo] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setFallo(false);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
      setFallo(true);
    }
  };

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void copiar()}
        className="flex shrink-0 items-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card-hover)]"
        aria-label={`Copiar ${etiqueta}`}
      >
        {copiado ? (
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        )}
        {copiado ? 'Copiado' : 'Copiar'}
      </button>
      {fallo ? (
        <span role="alert" className="max-w-40 text-right text-[11px] text-[var(--fin-out)]">
          No se pudo copiar. Mantén pulsado el texto para copiarlo.
        </span>
      ) : null}
    </span>
  );
};

/**
 * Configuración del Atajo de iOS: la llave autentica el teléfono sin exponer
 * la sesión normal de LukApp. El servidor conserva solo su hash.
 */
export const PanelAtajos: React.FC = () => {
  const [llaves, setLlaves] = useState<LlaveAtajo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState<{ llave: string; pista: string } | null>(null);

  const conToken = useCallback(async <T,>(hacer: (token: string) => Promise<T>): Promise<T> => {
    const cliente = obtenerSupabase();
    const session = cliente ? (await cliente.auth.getSession()).data.session : null;
    if (!session?.access_token) throw new Error('Sesión no disponible');
    return hacer(session.access_token);
  }, []);

  const cargar = useCallback(() => {
    conToken(async (token) => {
      const res = await fetch(apiUrl('/api/atajos/llave'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('No se pudieron cargar las llaves');
      const data = await res.json();
      setLlaves(data.llaves ?? []);
    }).catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las llaves'));
  }, [conToken]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = async () => {
    setCreando(true);
    setError(null);
    try {
      await conToken(async (token) => {
        const res = await fetch(apiUrl('/api/atajos/llave'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ etiqueta: 'Mi iPhone' }),
        });
        if (!res.ok) throw new Error('No se pudo crear la llave');
        const data = await res.json();
        setNueva({ llave: data.llave, pista: data.pista });
      });
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la llave');
    } finally {
      setCreando(false);
    }
  };

  const revocar = async (id: string) => {
    setError(null);
    try {
      await conToken(async (token) => {
        const res = await fetch(apiUrl('/api/atajos/revocar'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error('No se pudo revocar la llave');
      });
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo revocar la llave');
    }
  };

  const vivas = (llaves ?? []).filter((l) => !l.revocada_en);
  const urlEndpoint = apiUrl('/api/atajo/movimiento');

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 px-1 text-[15px] font-semibold text-[var(--fin-ink-soft)]">
          <Smartphone className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          Registro con Atajos
        </h2>
        <p className="mt-1 px-1 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
          La llave permite que una automatización de iPhone envíe a LukApp el texto de una notificación de Nequi y registre su ingreso o gasto.
        </p>
      </div>

      <div className="flex gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--fin-accent)]" aria-hidden="true" />
        <div>
          <p className="text-[14px] font-semibold text-[var(--fin-ink)]">¿Por qué necesita una llave?</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
            Atajos funciona fuera de tu sesión de LukApp, por eso usa una llave propia. Puede registrar movimientos en tu cuenta; no es tu contraseña ni la clave de Nequi. LukApp guarda una huella protegida y puedes revocarla desde aquí. No compartas el Atajo si contiene esta llave.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-[var(--fin-r-card)] bg-[var(--fin-out-bg)] px-4 py-3 text-[13px] leading-relaxed text-[var(--fin-out-ink)]">
          {error}
        </p>
      ) : null}

      {nueva ? (
        <div className="flex flex-col gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-accent)] bg-[var(--fin-soft)] p-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--fin-accent)]" aria-hidden="true" />
            <div>
              <p className="text-[14px] font-semibold text-[var(--fin-ink)]">Copia esta llave para el Atajo</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
                Solo se muestra ahora. Toca <strong>Copiar</strong> y pégala en <strong>x-api-key</strong>. No agregues “Bearer” ni la compartas.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-3 text-[13px] text-[var(--fin-ink)]">
              {nueva.llave}
            </code>
            <BotonCopiar valor={nueva.llave} etiqueta="la llave" />
          </div>
          <button
            type="button"
            onClick={() => setNueva(null)}
            className="self-start text-[13px] font-semibold text-[var(--fin-ink-soft)] underline underline-offset-2"
          >
            Ya la pegué en Atajos
          </button>
        </div>
      ) : null}

      <div className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        {llaves === null ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <p className="text-[13px] text-[var(--fin-ink-faint)]">
              {error ? 'No pudimos cargar tus llaves.' : 'Cargando tus llaves…'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  cargar();
                }}
                className="rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-ink)]"
              >
                Reintentar
              </button>
            ) : null}
          </div>
        ) : vivas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <KeyRound className="h-8 w-8 text-[var(--fin-ink-ghost)]" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-[15px] font-semibold text-[var(--fin-ink)]">Paso 1 · Crea una llave de conexión</p>
            <p className="text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
              La llave autoriza al Atajo a enviar movimientos a tu cuenta. LukApp guarda una huella segura, no la llave original.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[13px] font-semibold text-[var(--fin-ink-soft)]">Llaves activas</p>
          <ul className="flex flex-col gap-3">
            {vivas.map((l) => (
              <li key={l.id} className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]"
                  aria-hidden="true"
                >
                  <KeyRound className="h-[18px] w-[18px] text-[var(--fin-ink-soft)]" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-[var(--fin-ink)]">
                    {l.etiqueta} · ···{l.pista}
                  </span>
                  <span className="mt-1 block text-[13px] text-[var(--fin-ink-faint)]">
                    Creada el {fechaCorta(l.creada_en)}
                    {l.usada_en ? ` · usada por última vez el ${fechaCorta(l.usada_en)}` : ' · nunca usada'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void revocar(l.id)}
                  className="flex shrink-0 items-center gap-2 rounded-[var(--fin-r-control)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-out)] transition-colors hover:bg-[var(--fin-out-bg)]"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                  Revocar
                </button>
              </li>
            ))}
          </ul>
          </>
        )}

        <button
          type="button"
          onClick={() => void crear()}
          disabled={creando}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-3 text-[17px] font-semibold text-[var(--fin-on-accent)] disabled:opacity-60"
        >
          <Plus className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
          {creando ? 'Creando…' : vivas.length ? 'Crear otra llave' : 'Crear llave para mi iPhone'}
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <p className="text-[14px] font-semibold text-[var(--fin-ink)]">Paso 2 · Instala el Atajo en tu iPhone</p>
        <p className="text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
          El enlace instala el Atajo manual de LukApp. Para los avisos, crea una automatización de notificación de Nequi en Atajos y usa la misma dirección y llave de este panel.
        </p>
        <a
          href={URL_ATAJO_ICLOUD}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-3 text-[17px] font-semibold text-[var(--fin-on-accent)]"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          Añadir Atajo de LukApp
        </a>
        <ol className="flex flex-col gap-2 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
          <li>Toca el botón y, cuando se abra Atajos, elige <strong>Agregar atajo</strong>.</li>
          <li>
            En Atajos, abre <strong>Mis atajos</strong> y toca los tres puntos del Atajo de LukApp para editarlo.
          </li>
          <li>
            Busca <strong>Obtener contenido de URL</strong> → <strong>Encabezados</strong> →
            <strong>x-api-key</strong>. Pega la llave que copiaste, tal cual; no agregues “Bearer”.
          </li>
          <li>Guarda. Al ejecutar el Atajo, escribe el monto y el nombre de la persona o comercio.</li>
        </ol>

        <details className="rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2 text-[13px] text-[var(--fin-ink-faint)]">
          <summary className="cursor-pointer font-semibold text-[var(--fin-ink-soft)]">
            Preparar avisos de Nequi en iPhone
          </summary>
          <ol className="mt-2 flex flex-col gap-2 leading-relaxed">
            <li>En un iPhone con iOS 26 o posterior, abre Atajos → Automatización y crea un disparador de tipo <strong>Notificación</strong> para la app <strong>Nequi</strong>. Filtra el campo <strong>Mensaje</strong> por <code>COP</code> para capturar avisos de ingresos y pagos que incluyen el monto en pesos. Agrega <strong>Vista rápida</strong> solo para revisar una notificación de prueba y quítala al terminar de validar.</li>
            <li>Después de confirmar que la entrada trae la frase y el monto, agrega <strong>Obtener contenido de URL</strong>: elige POST, usa la dirección de LukApp que aparece en «Configuración manual» y añade el encabezado <code>x-api-key</code> con la llave creada arriba.</li>
            <li>Antes de la petición, agrega <strong>Fecha actual</strong>, conviértela a texto con <strong>Formatear fecha</strong> en formato <strong>ISO 8601</strong> y usa esa salida como <code>idempotency_key</code>. En el cuerpo JSON inserta también la variable mágica del aviso en <code>notificacion</code>. LukApp combina fecha y aviso para formar el ID; si reintentas la misma ejecución, reutiliza esa salida. La vista previa funciona sin esta clave; el registro real la exige.</li>
            <pre className="overflow-x-auto rounded-[var(--fin-r-control)] bg-[var(--fin-card)] p-3 text-[12px] leading-relaxed text-[var(--fin-ink)]">{`{
  "origen": "nequi",
  "notificacion": "[Entrada del atajo]",
  "idempotency_key": "[Salida de Fecha actual]",
  "solo_prueba": true
}`}</pre>
            <li>Mantén <code>solo_prueba</code> como Booleano <code>true</code> hasta revisar monto, tipo, cuenta e idempotencia en la vista previa. Luego cambia a Booleano <code>false</code> para guardar avisos reconocidos; el servidor rechazará el registro real si falta el UUID o la clave estable.</li>
            <li>LukApp reconoce confirmaciones como «Acabas de recibir plata de…» y «Pagaste… en…». Rechaza textos ambiguos y avisos de Transfiya pendientes. La fecha usa el día de Bogotá en que se procesa el aviso, salvo que envíes <code>fecha</code>.</li>
            <li>No incluyas la llave en el cuerpo ni en la URL: viaja solo en el encabezado. La vista previa requiere una cuenta activa tipo billetera cuyo nombre incluya <strong>Nequi</strong>; si tienes varias, configura cuál usar antes de guardar.</li>
          </ol>
        </details>

        <details className="rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2 text-[13px] text-[var(--fin-ink-faint)]">
          <summary className="cursor-pointer font-semibold text-[var(--fin-ink-soft)]">
            Probar la conexión sin registrar un movimiento
          </summary>
          <ol className="mt-2 flex flex-col gap-2 leading-relaxed">
            <li>
              En <strong>Obtener contenido de URL → Cuerpo de la solicitud → JSON</strong>, agrega
              <code>solo_prueba</code> con tipo <strong>Booleano</strong> y valor <strong>true</strong>.
            </li>
            <li>
              Después de la petición agrega <strong>Vista rápida</strong> para revisar el monto,
              destinatario, fecha, tipo y cuenta que LukApp entendió.
            </li>
            <li>
              Ejecuta el Atajo con datos ficticios. LukApp devuelve una vista previa y valida la llave, pero no crea ni modifica movimientos.
            </li>
          </ol>
        </details>

        <details className="mt-1 text-[13px] text-[var(--fin-ink-faint)]">
          <summary className="cursor-pointer font-semibold text-[var(--fin-ink-soft)]">
            Configuración manual (avanzada)
          </summary>
          <ol className="mt-2 flex flex-col gap-2 leading-relaxed">
            <li>
              En <strong>Obtener contenido de URL</strong>, usa método <strong>POST</strong> y esta dirección:
            </li>
          </ol>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-3 text-[13px] text-[var(--fin-ink)]">
              {urlEndpoint}
            </code>
            <BotonCopiar valor={urlEndpoint} etiqueta="la dirección" />
          </div>
          <ol start={2} className="mt-2 flex flex-col gap-2 leading-relaxed">
            <li>
              En Encabezados, añade <code>x-api-key</code> y pega tu llave, sin “Bearer”.
            </li>
            <li>
              En el cuerpo JSON, envía <code>monto</code> y <code>comercio</code> con los datos de la transferencia.
            </li>
          </ol>
        </details>
      </div>
    </section>
  );
};
