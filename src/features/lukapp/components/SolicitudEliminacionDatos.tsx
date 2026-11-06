import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import { BrandWordmark } from './BrandWordmark';

const CORREO_PROTECCION_DATOS = 'jsgonzalezdevs@gmail.com';

const TIPOS_DE_DATO = [
  'Movimientos, ingresos y gastos',
  'Cuentas, saldos y tarjetas',
  'Presupuestos, metas y deudas',
  'Contactos y gastos compartidos',
  'Conversaciones o recuerdos del Asesor',
  'Archivos y extractos importados',
] as const;

type Alcance = 'total' | 'parcial';

const enlaceDeCorreo = ({ correo, alcance, tipos, detalle }: {
  correo: string;
  alcance: Alcance;
  tipos: string[];
  detalle: string;
}): string => {
  const alcanceTexto = alcance === 'total'
    ? 'Eliminar todos mis datos de LukApp y conservar mi cuenta activa.'
    : 'Eliminar solo una parte de mis datos y conservar mi cuenta activa.';
  const datosSolicitados = alcance === 'total'
    ? 'Todos los datos asociados a mi uso de LukApp.'
    : tipos.join(', ');
  const cuerpo = [
    'Solicitud de eliminación de datos — LukApp',
    '',
    `Correo para responder: ${correo}`,
    `Solicitud: ${alcanceTexto}`,
    `Datos que deseo eliminar: ${datosSolicitados}`,
    detalle ? `Detalle adicional: ${detalle}` : '',
    '',
    'Entiendo que esta solicitud no elimina mi cuenta.',
  ].filter(Boolean).join('\n');

  return `mailto:${CORREO_PROTECCION_DATOS}?subject=${encodeURIComponent('Solicitud de eliminación de datos — LukApp')}&body=${encodeURIComponent(cuerpo)}`;
};

/** Página pública: evita requerir acceso a la cuenta para ejercer este derecho. */
export const SolicitudEliminacionDatos: React.FC = () => {
  const [correo, setCorreo] = useState('');
  const [alcance, setAlcance] = useState<Alcance>('total');
  const [tipos, setTipos] = useState<string[]>([]);
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  const enlaceCorreo = useMemo(
    () => enlaceDeCorreo({ correo, alcance, tipos, detalle }),
    [alcance, correo, detalle, tipos],
  );

  const alternarTipo = (tipo: string) => {
    setTipos((actuales) => actuales.includes(tipo)
      ? actuales.filter((actual) => actual !== tipo)
      : [...actuales, tipo]);
  };

  const enviarSolicitud = (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (alcance === 'parcial' && tipos.length === 0 && detalle.trim() === '') {
      setError('Cuéntanos qué datos quieres eliminar para poder atender tu solicitud.');
      return;
    }
    setError('');
    setEnviado(true);
    window.location.href = enlaceCorreo;
  };

  return (
    <main className="min-h-dvh bg-[#fbf9f6] px-4 py-5 text-[#1c1917] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="rounded-3xl border border-[#e5ded5] bg-white p-6 shadow-sm sm:p-9">
          <div className="flex items-center justify-between gap-4">
            <a href="/" className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-[#6b6560] hover:bg-[#f4f0eb]">
              <ArrowLeft size={17} aria-hidden /> Volver a LukApp
            </a>
            <BrandWordmark className="h-7 w-auto" />
          </div>
          <div className="mt-9 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#772aea]/10 px-3 py-1.5 text-xs font-bold text-[#772aea]">
              <ShieldCheck size={14} aria-hidden /> Control de tus datos
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Solicita eliminar tus datos</h1>
            <p className="mt-4 text-base leading-7 text-[#6b6560]">
              Puedes pedir que eliminemos una parte o todos tus datos de LukApp sin borrar tu cuenta.
              Esta página es pública: no necesitas iniciar sesión para usarla.
            </p>
          </div>
        </header>

        <section className="mt-5 rounded-3xl border border-[#e5ded5] bg-white p-6 shadow-sm sm:p-9" aria-labelledby="titulo-formulario">
          <h2 id="titulo-formulario" className="text-xl font-black tracking-tight sm:text-2xl">Cuéntanos qué necesitas eliminar</h2>
          <p className="mt-2 text-sm leading-6 text-[#6b6560]">Abriremos tu correo con la solicitud ya preparada para que la revises y la envíes al canal de protección de datos.</p>

          <form className="mt-7 space-y-7" onSubmit={enviarSolicitud}>
            <label className="block">
              <span className="text-sm font-bold">Correo asociado a tu cuenta o medio para responder</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={correo}
                onChange={(evento) => setCorreo(evento.target.value)}
                placeholder="tu@correo.com"
                className="mt-2 block w-full rounded-xl border border-[#d8d2ca] bg-white px-4 py-3 text-base outline-none transition focus:border-[#772aea] focus:ring-4 focus:ring-[#772aea]/10"
              />
            </label>

            <fieldset>
              <legend className="text-sm font-bold">¿Qué quieres eliminar?</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className={`cursor-pointer rounded-2xl border p-4 transition ${alcance === 'total' ? 'border-[#772aea] bg-[#772aea]/5 ring-2 ring-[#772aea]/10' : 'border-[#e5ded5] hover:bg-[#fbf9f6]'}`}>
                  <input className="sr-only" type="radio" name="alcance" value="total" checked={alcance === 'total'} onChange={() => setAlcance('total')} />
                  <span className="block text-sm font-bold">Todos mis datos</span>
                  <span className="mt-1 block text-xs leading-5 text-[#6b6560]">Eliminaremos la información asociada a tu uso de LukApp.</span>
                </label>
                <label className={`cursor-pointer rounded-2xl border p-4 transition ${alcance === 'parcial' ? 'border-[#772aea] bg-[#772aea]/5 ring-2 ring-[#772aea]/10' : 'border-[#e5ded5] hover:bg-[#fbf9f6]'}`}>
                  <input className="sr-only" type="radio" name="alcance" value="parcial" checked={alcance === 'parcial'} onChange={() => setAlcance('parcial')} />
                  <span className="block text-sm font-bold">Solo una parte</span>
                  <span className="mt-1 block text-xs leading-5 text-[#6b6560]">Elige las categorías o descríbenos exactamente qué información es.</span>
                </label>
              </div>
            </fieldset>

            {alcance === 'parcial' && (
              <fieldset>
                <legend className="text-sm font-bold">Datos que quieres eliminar</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {TIPOS_DE_DATO.map((tipo) => (
                    <label key={tipo} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e5ded5] px-4 py-3 text-sm hover:bg-[#fbf9f6]">
                      <input type="checkbox" checked={tipos.includes(tipo)} onChange={() => alternarTipo(tipo)} className="mt-0.5 h-4 w-4 accent-[#772aea]" />
                      <span>{tipo}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <label className="block">
              <span className="text-sm font-bold">Detalle adicional <span className="font-normal text-[#6b6560]">(opcional)</span></span>
              <textarea
                value={detalle}
                onChange={(evento) => setDetalle(evento.target.value)}
                rows={4}
                placeholder="Por ejemplo: los movimientos de enero de 2026 o un extracto específico."
                className="mt-2 block w-full resize-y rounded-xl border border-[#d8d2ca] bg-white px-4 py-3 text-base outline-none transition focus:border-[#772aea] focus:ring-4 focus:ring-[#772aea]/10"
              />
            </label>

            <div className="rounded-2xl bg-[#f4f0eb] p-4 text-sm leading-6 text-[#514b46]">
              <strong className="text-[#1c1917]">Tu cuenta seguirá activa.</strong> Esta solicitud elimina datos, no tu cuenta. Si necesitas eliminar la cuenta completa, puedes hacerlo desde los ajustes de LukApp.
            </div>

            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p>}

            <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#772aea] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#6521cf] sm:w-auto">
              <Mail size={17} aria-hidden /> Preparar solicitud por correo
            </button>
          </form>

          {enviado && (
            <p className="mt-5 flex items-start gap-2 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800" role="status">
              <CheckCircle2 className="mt-0.5 shrink-0" size={18} aria-hidden />
              <span>Se abrió tu aplicación de correo con la solicitud. Si no se abrió, <a className="font-bold underline underline-offset-2" href={enlaceCorreo}>abre el correo preparado aquí</a>.</span>
            </p>
          )}
        </section>

        <p className="px-2 py-7 text-center text-xs leading-5 text-[#6b6560]">
          Consulta cómo tratamos tus datos en la <a href="/legal#privacidad" className="font-semibold text-[#772aea] underline underline-offset-2">Política de tratamiento de datos personales</a>.
        </p>
      </div>
    </main>
  );
};
