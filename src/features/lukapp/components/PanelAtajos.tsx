import React, { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, Copy, ExternalLink, Info, KeyRound, Plus, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { apiUrl } from '../../../lib/api';
import { obtenerSupabase } from '../data/supabase';

/** El Atajo publicado en iCloud para registrar movimientos manualmente. */
const URL_ATAJO_ICLOUD = 'https://www.icloud.com/shortcuts/5331c6951e0e411c96a6bf39adaeb95c';
/** Plantilla de Nequi con el disparador y la pregunta de llave ya enlazados. */
const URL_ATAJO_NEQUI = 'https://www.icloud.com/shortcuts/6bbf9bd68868420da3c493554bbf83da';

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
  const [tipoAtajo, setTipoAtajo] = useState<'nequi' | 'manual'>('nequi');
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
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="px-1">
        <h2 className="text-[20px] font-semibold tracking-tight text-[var(--fin-ink)]">Conecta tu iPhone</h2>
        <p className="mt-1 text-[14px] text-[var(--fin-ink-soft)]">Una llave para tus ingresos y gastos. Se configura una sola vez.</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-[var(--fin-r-card)] bg-[var(--fin-out-bg)] px-4 py-3 text-[13px] text-[var(--fin-out-ink)]">{error}</p>
      ) : null}

      <div className="flex gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-4 sm:gap-4 sm:p-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fin-soft)] text-[14px] font-bold text-[var(--fin-accent)]">1</span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-[16px] font-semibold text-[var(--fin-ink)]"><KeyRound className="h-4 w-4" aria-hidden="true" /> Tu llave de conexión</h3>
          {llaves === null ? (
            <div className="mt-3 text-[13px] text-[var(--fin-ink-soft)]">
              <p>{error ? 'No pudimos cargar tus llaves.' : 'Cargando…'}</p>
              {error ? <button type="button" onClick={() => { setError(null); cargar(); }} className="mt-2 font-semibold text-[var(--fin-accent)]">Reintentar</button> : null}
            </div>
          ) : nueva ? (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-[13px] text-[var(--fin-ink-soft)]">Cópiala ahora. Al instalar el atajo te la pedirá.</p>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-[var(--fin-r-control)] bg-[var(--fin-bg)] px-3 py-3 text-[12px] text-[var(--fin-ink)]">{nueva.llave}</code>
                <BotonCopiar valor={nueva.llave} etiqueta="la llave" />
              </div>
              <p className="flex items-center gap-1.5 text-[12px] text-[var(--fin-ink-faint)]"><ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Solo se muestra esta vez. Guárdala en tu atajo.</p>
              <button type="button" onClick={() => setNueva(null)} className="self-start text-[13px] font-semibold text-[var(--fin-accent)]">Ya la pegué en Atajos</button>
            </div>
          ) : vivas.length ? (
            <div className="mt-3 flex items-start gap-2 text-[13px] text-[var(--fin-ink-soft)]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-accent)]" aria-hidden="true" />
              <p>Ya tienes {vivas.length === 1 ? 'una llave creada' : `${vivas.length} llaves creadas`}. Reutiliza la que guardaste en Atajos.</p>
            </div>
          ) : (
            <>
              <p className="mt-2 text-[13px] text-[var(--fin-ink-soft)]">Permite que Atajos registre movimientos en tu cuenta.</p>
              <button type="button" onClick={() => void crear()} disabled={creando} className="mt-3 inline-flex items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-3 text-[14px] font-semibold text-[var(--fin-on-accent)] disabled:opacity-60">
                <Plus className="h-4 w-4" aria-hidden="true" />{creando ? 'Creando…' : 'Crear mi llave'}
              </button>
            </>
          )}
          {vivas.length > 0 ? (
            <details className="mt-3 text-[12px] text-[var(--fin-ink-faint)]">
              <summary className="cursor-pointer py-1 font-medium">Administrar llaves</summary>
              <ul className="mt-2 flex flex-col divide-y divide-[var(--fin-line)]">
                {vivas.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-[var(--fin-ink)]">{l.etiqueta} · ···{l.pista}</span>
                      <span className="mt-1 block">{l.usada_en ? `Último uso: ${fechaCorta(l.usada_en)}` : `Creada: ${fechaCorta(l.creada_en)} · Sin uso`}</span>
                    </span>
                    <button type="button" onClick={() => void revocar(l.id)} className="inline-flex items-center gap-1.5 rounded-[var(--fin-r-control)] px-2 py-2 text-[12px] font-semibold text-[var(--fin-out)] hover:bg-[var(--fin-out-bg)]"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Revocar</button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 leading-relaxed">La llave completa no se puede volver a mostrar. Si la perdiste, crea otra y actualiza tu atajo.</p>
              <button type="button" onClick={() => void crear()} disabled={creando} className="mt-2 inline-flex items-center gap-1.5 py-2 font-semibold text-[var(--fin-accent)] disabled:opacity-60"><Plus className="h-3.5 w-3.5" aria-hidden="true" />{creando ? 'Creando…' : 'Crear otra llave'}</button>
            </details>
          ) : null}
        </div>
      </div>

      <div className="flex gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-4 sm:gap-4 sm:p-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fin-soft)] text-[14px] font-bold text-[var(--fin-accent)]">2</span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-[16px] font-semibold text-[var(--fin-ink)]"><Smartphone className="h-4 w-4" aria-hidden="true" /> Añade tu atajo</h3>
          <div role="group" aria-label="Tipo de atajo" className="mt-3 flex gap-1 rounded-[var(--fin-r-control)] bg-[var(--fin-bg)] p-1">
            {([['nequi', 'Nequi Colombia'], ['manual', 'Otros movimientos']] as const).map(([tipo, titulo]) => (
              <button key={tipo} type="button" aria-pressed={tipoAtajo === tipo} onClick={() => setTipoAtajo(tipo)} className={`flex-1 rounded-[var(--fin-r-control)] px-2 py-2.5 text-[12px] font-semibold transition-colors ${tipoAtajo === tipo ? 'bg-[var(--fin-card)] text-[var(--fin-ink)] shadow-sm' : 'text-[var(--fin-ink-faint)]'}`}>{titulo}</button>
            ))}
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">{tipoAtajo === 'nequi' ? 'Convierte los avisos de Nequi en ingresos y gastos.' : 'Registra un monto y una persona o comercio desde Atajos.'}</p>
          <a href={tipoAtajo === 'nequi' ? URL_ATAJO_NEQUI : URL_ATAJO_ICLOUD} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-3 text-[14px] font-semibold text-[var(--fin-on-accent)]">
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />{tipoAtajo === 'nequi' ? 'Añadir atajo de Nequi' : 'Añadir atajo manual'}
          </a>
          <p className="mt-2 text-[12px] text-[var(--fin-ink-faint)]">{tipoAtajo === 'nequi' ? 'iPhone · iOS 27 o posterior' : 'Se abre en Atajos de tu iPhone'}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">{tipoAtajo === 'nequi' ? 'Toca «Agregar atajo» y pega tu llave cuando te la pida.' : <>Abre el editor y pega tu llave en <strong>Encabezados → x-api-key</strong>.</>}</p>
        </div>
      </div>

      <div className="flex gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-4 sm:gap-4 sm:p-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fin-soft)] text-[14px] font-bold text-[var(--fin-accent)]">3</span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-[16px] font-semibold text-[var(--fin-ink)]"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Revisa y activa</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">{tipoAtajo === 'nequi' ? 'Revisa la vista previa antes de activar el registro de avisos.' : 'Prueba la conexión antes de guardar tu primer movimiento.'}</p>
          <details className="mt-3 rounded-[var(--fin-r-control)] bg-[var(--fin-bg)] px-3 py-1 text-[13px] text-[var(--fin-ink-soft)]">
            <summary className="cursor-pointer py-2 font-semibold">Ver cómo activarlo</summary>
            <ol className="mb-2 flex list-decimal flex-col gap-3 pl-4 leading-relaxed">
              <li>En el editor del atajo, usa <code>solo_prueba: true</code> y añade <strong>Mostrar contenido</strong> después del envío para ver el resultado.</li>
              <li>Comprueba monto, tipo y cuenta. Luego cambia <code>solo_prueba</code> a Booleano <code>false</code> para guardar movimientos.</li>
              {tipoAtajo === 'nequi' ? <li>Revisa <strong>Automatización → Notificación → Nequi Colombia</strong> y permite la conexión con LukApp.</li> : <li>Ejecuta el atajo e indica el monto y la persona o comercio.</li>}
            </ol>
          </details>
        </div>
      </div>

      <details className="group rounded-[var(--fin-r-card)] border border-[var(--fin-line)] px-4 py-1 text-[13px] text-[var(--fin-ink-faint)]">
        <summary className="flex cursor-pointer list-none items-center gap-2 py-3 font-medium"><Info className="h-4 w-4 shrink-0" aria-hidden="true" /> Ayuda y configuración avanzada<ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
        <div className="flex flex-col gap-3 pb-3">
          <p className="leading-relaxed">Tu llave permite registrar movimientos en LukApp. No es la clave de Nequi. Guárdala en el atajo y revócala desde aquí si dejas de usarla. Nunca la incluyas en un enlace.</p>
        <details className="rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2 text-[13px] text-[var(--fin-ink-faint)]">
          <summary className="cursor-pointer font-semibold text-[var(--fin-ink-soft)]">
            Preparar avisos de Nequi en iPhone
          </summary>
          <ol className="mt-2 flex flex-col gap-2 leading-relaxed">
            <li>En un iPhone con iOS 27 o posterior, abre el editor del atajo y busca <strong>Automatización → Notificación</strong>. Elige <strong>Nequi Colombia</strong>. No hace falta filtrar por “COP”: LukApp revisa el texto y rechaza los avisos que no confirman un movimiento. En iOS 26 no existe este disparador de notificación.</li>
            <li>Agrega <strong>Obtener texto de</strong>, selecciona la variable <strong>Notificación</strong> y su propiedad <strong>Cuerpo</strong>. Ese texto debe incluir la frase y el monto. Luego agrega <strong>Obtener contenido de URL</strong>: elige POST, usa la dirección de LukApp que aparece en «Configuración manual» y añade el encabezado <code>x-api-key</code> con la llave creada arriba.</li>
            <li>Antes de la petición, agrega <strong>Fecha actual</strong>, conviértela a texto con <strong>Formatear fecha</strong> en formato <strong>ISO 8601</strong> y usa esa salida como <code>idempotency_key</code>. En el cuerpo JSON inserta la salida de <strong>Obtener texto de Cuerpo</strong> en <code>notificacion</code>; no dejes “Entrada” vacía ni escribas el nombre de la variable como texto. LukApp combina fecha y aviso para formar el ID; si reintentas la misma ejecución, reutiliza esa salida. La vista previa también exige una llave válida, pero no guarda el movimiento.</li>
            <pre className="overflow-x-auto rounded-[var(--fin-r-control)] bg-[var(--fin-card)] p-3 text-[12px] leading-relaxed text-[var(--fin-ink)]">{`{
  "origen": "nequi",
  "notificacion": "[Texto del cuerpo de la notificación]",
  "idempotency_key": "[Salida de Fecha actual]",
  "solo_prueba": true
}`}</pre>
            <li>Mantén <code>solo_prueba</code> como Booleano <code>true</code> hasta revisar monto, tipo, cuenta e idempotencia en la vista previa. Luego cambia a Booleano <code>false</code> para guardar avisos reconocidos; el servidor rechazará el registro real si falta el UUID o la clave estable.</li>
            <li>LukApp reconoce confirmaciones como «Acabas de recibir plata de…» y «Pagaste… en…». Rechaza textos ambiguos y avisos de Transfiya pendientes. La fecha usa el día de Bogotá en que se procesa el aviso, salvo que envíes <code>fecha</code>.</li>
            <li>No incluyas la llave en el cuerpo ni en la URL: viaja solo en el encabezado. La vista previa requiere una cuenta activa cuyo nombre incluya <strong>Nequi</strong> y cuya clase sea billetera, o una cuenta antigua que todavía no tenga clase. Si tienes varias, configura cuál usar antes de guardar.</li>
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
              Ejecuta el Atajo con datos ficticios. LukApp exige una llave válida y devuelve una vista previa, pero no crea ni modifica movimientos.
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
      </details>
    </section>
  );
};
