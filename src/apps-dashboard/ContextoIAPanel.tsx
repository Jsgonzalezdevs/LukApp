import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Check, FileText, Loader2, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { obtenerSupabase } from '../features/lukapp/data/supabase';
import { apiUrl } from '../lib/api';

type AlcanceDocumento = 'general' | 'producto' | 'finanzas' | 'extractos';

interface DocumentoConocimiento {
  id: string;
  nombre: string;
  alcance: AlcanceDocumento;
  tipo_mime: string;
  tamano_bytes: number;
  caracteres: number;
  activo: boolean;
  creado_en: string;
}

const ETIQUETAS: Record<AlcanceDocumento, string> = {
  general: 'General',
  producto: 'Uso de LukApp',
  finanzas: 'Finanzas',
  extractos: 'Importación y extractos',
};

const formatoBytes = (bytes: number): string => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export const ContextoIAPanel: React.FC = () => {
  const [documentos, setDocumentos] = useState<DocumentoConocimiento[]>([]);
  const [alcance, setAlcance] = useState<AlcanceDocumento>('producto');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<{ nombre: string; texto: string } | null>(null);
  const entradaArchivo = useRef<HTMLInputElement>(null);

  const solicitar = useCallback(async (ruta: string, opciones: RequestInit = {}) => {
    const cliente = obtenerSupabase();
    const { data: { session } } = await cliente!.auth.getSession();
    if (!session) throw new Error('Tu sesión terminó. Inicia sesión de nuevo.');
    const respuesta = await fetch(apiUrl(ruta), {
      ...opciones,
      headers: { Authorization: `Bearer ${session.access_token}`, ...(opciones.headers ?? {}) },
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.error || 'No se pudo completar la acción.');
    return datos;
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await solicitar('/api/superadmin/ia/conocimiento');
      setDocumentos(Array.isArray(datos.documentos) ? datos.documentos : []);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar la biblioteca.');
    } finally {
      setCargando(false);
    }
  }, [solicitar]);

  useEffect(() => { void cargar(); }, [cargar]);

  const adjuntar = async () => {
    if (!archivo) {
      setError('Selecciona un PDF, TXT o Markdown para adjuntarlo.');
      return;
    }
    if (archivo.size > 4 * 1024 * 1024) {
      setError('El archivo no puede superar 4 MB.');
      return;
    }
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const archivoBase64 = await new Promise<string>((resolve, reject) => {
        const lector = new FileReader();
        lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        lector.onload = () => {
          const contenido = String(lector.result ?? '');
          const separador = contenido.indexOf(',');
          if (separador < 0) reject(new Error('El archivo no se pudo codificar.'));
          else resolve(contenido.slice(separador + 1));
        };
        lector.readAsDataURL(archivo);
      });
      const datos = await solicitar('/api/superadmin/ia/conocimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: archivo.name, alcance, archivoBase64 }),
      });
      setVistaPrevia({ nombre: datos.documento.nombre, texto: datos.vistaPrevia || '' });
      setAviso('Documento guardado como borrador. Actívalo cuando confirmes que su contenido está correcto.');
      setArchivo(null);
      if (entradaArchivo.current) entradaArchivo.current.value = '';
      await cargar();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo adjuntar el documento.');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (documento: DocumentoConocimiento) => {
    setError(null);
    try {
      await solicitar(`/api/superadmin/ia/conocimiento/${documento.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !documento.activo }),
      });
      setAviso(documento.activo ? 'Documento desactivado; ya no se consultará.' : 'Documento activado para dar contexto a la IA.');
      await cargar();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo cambiar el estado del documento.');
    }
  };

  const eliminar = async (documento: DocumentoConocimiento) => {
    if (!window.confirm(`¿Eliminar “${documento.nombre}” y su archivo privado?`)) return;
    setError(null);
    try {
      await solicitar(`/api/superadmin/ia/conocimiento/${documento.id}`, { method: 'DELETE' });
      setAviso('Documento eliminado de la biblioteca.');
      if (vistaPrevia?.nombre === documento.nombre) setVistaPrevia(null);
      await cargar();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo eliminar el documento.');
    }
  };

  return (
    <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-purple-100 p-2.5 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"><BookOpen className="h-5 w-5" /></span>
          <div>
            <h3 className="font-extrabold text-[var(--fin-ink)]">Conocimiento de LukApp para la IA</h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--fin-ink-soft)]">Adjunta guías o documentación para que el Asesor responda con pasos y detalles verificados. Los archivos quedan privados y nuevos documentos comienzan como borradores.</p>
          </div>
        </div>
        <button type="button" onClick={() => void cargar()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--fin-line)] px-3 py-2 text-xs font-bold text-[var(--fin-ink)] hover:bg-[var(--fin-soft)]" aria-label="Actualizar biblioteca">
          <RefreshCw className={`h-3.5 w-3.5 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl bg-[var(--fin-soft)] p-4 md:grid-cols-[minmax(0,1fr)_210px_auto] md:items-end">
        <label className="block text-xs font-bold text-[var(--fin-ink)]">
          Documento (PDF, TXT o MD; máximo 4 MB)
          <input ref={entradaArchivo} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={(evento) => setArchivo(evento.target.files?.[0] ?? null)} className="mt-2 block w-full text-xs font-medium file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--fin-card)] file:px-3 file:py-2 file:font-bold file:text-[var(--fin-ink)]" />
        </label>
        <label className="block text-xs font-bold text-[var(--fin-ink)]">
          Tema
          <select value={alcance} onChange={(evento) => setAlcance(evento.target.value as AlcanceDocumento)} className="mt-2 w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2.5 text-xs">
            {Object.entries(ETIQUETAS).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void adjuntar()} disabled={guardando || !archivo} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50">
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {guardando ? 'Procesando…' : 'Adjuntar documento'}
        </button>
      </div>

      {error && <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
      {aviso && <div role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{aviso}</div>}

      {vistaPrevia && (
        <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50/70 p-4 dark:border-purple-900 dark:bg-purple-950/20">
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-extrabold text-purple-800 dark:text-purple-200"><FileText className="h-4 w-4" /> Vista previa extraída: {vistaPrevia.nombre}</p>
            <button type="button" onClick={() => setVistaPrevia(null)} aria-label="Cerrar vista previa" className="text-purple-700"><X className="h-4 w-4" /></button>
          </div>
          <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-[var(--fin-ink)]">{vistaPrevia.texto || 'No se pudo mostrar una vista previa.'}</p>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="text-xs font-extrabold text-[var(--fin-ink)]">Documentos disponibles para administrar</h4>
          <span className="text-[11px] text-[var(--fin-ink-soft)]">{documentos.filter((documento) => documento.activo).length} activos</span>
        </div>
        {cargando && documentos.length === 0 ? <div className="flex items-center gap-2 py-5 text-xs text-[var(--fin-ink-soft)]"><Loader2 className="h-4 w-4 animate-spin" /> Cargando biblioteca…</div> : null}
        {!cargando && documentos.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--fin-line)] px-4 py-5 text-center text-xs text-[var(--fin-ink-soft)]">Aún no hay documentos. Adjunta guías de LukApp para ampliar el contexto.</p> : null}
        <ul className="space-y-2">
          {documentos.map((documento) => (
            <li key={documento.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--fin-line)] px-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-purple-600" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[var(--fin-ink)]">{documento.nombre}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--fin-ink-soft)]">{ETIQUETAS[documento.alcance]} · {formatoBytes(documento.tamano_bytes)} · {documento.caracteres.toLocaleString('es-CO')} caracteres · {documento.activo ? 'Activo' : 'Borrador'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => void cambiarEstado(documento)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold ${documento.activo ? 'bg-[var(--fin-soft)] text-[var(--fin-ink)]' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                  {documento.activo ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  {documento.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button type="button" onClick={() => void eliminar(documento)} aria-label={`Eliminar ${documento.nombre}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 flex items-start gap-2 text-[10px] leading-4 text-[var(--fin-ink-faint)]"><Plus className="mt-0.5 h-3 w-3 shrink-0" /> La IA busca fragmentos relacionados con cada consulta. Revisa el texto extraído antes de activar; el contenido del documento se trata como referencia y no como una instrucción.</p>
    </section>
  );
};
