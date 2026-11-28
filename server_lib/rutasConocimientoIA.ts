/**
 * Biblioteca de documentos que el superadmin le adjunta a la IA (Superadmin →
 * IA & Tokens → Conocimiento). Sale de server.ts como un Router con sus
 * dependencias inyectadas: así las rutas no dependen de variables globales del
 * servidor y se pueden montar o probar por separado.
 */
import path from 'path';
import { createHash, randomUUID } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { PDFParse } from 'pdf-parse';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AlcanceDocumentoIA = 'general' | 'producto' | 'finanzas' | 'extractos';

export interface DependenciasConocimientoIA {
  clienteAdmin: () => SupabaseClient | null;
  exigirAdmin: (
    cliente: SupabaseClient,
    token: string,
  ) => Promise<{ userId: string; email: string } | { status: number; error: string }>;
  rateLimiter: (maxPeticiones?: number, ventanaMs?: number) => RequestHandler;
}

export const crearRutasConocimientoIA = ({ clienteAdmin, exigirAdmin, rateLimiter }: DependenciasConocimientoIA): Router => {
  const rutas = Router();

  const ALCANCES_DOCUMENTOS_IA = new Set<AlcanceDocumentoIA>(['general', 'producto', 'finanzas', 'extractos']);
  const MAX_BYTES_DOCUMENTO_IA = 4 * 1024 * 1024;
  const MAX_CARACTERES_DOCUMENTO_IA = 150_000;

  const cortarDocumentoEnFragmentos = (texto: string): string[] => {
    const fragmentos: string[] = [];
    const tamano = 1800;
    const solapamiento = 180;
    let inicio = 0;
    while (inicio < texto.length && fragmentos.length < 120) {
      let final = Math.min(inicio + tamano, texto.length);
      if (final < texto.length) {
        const corte = texto.lastIndexOf('\n', final);
        if (corte > inicio + tamano * 0.55) final = corte;
      }
      const fragmento = texto.slice(inicio, final).trim();
      if (fragmento) fragmentos.push(fragmento);
      if (final >= texto.length) break;
      inicio = Math.max(inicio + 1, final - solapamiento);
    }
    return fragmentos;
  };

  rutas.get('/api/superadmin/ia/conocimiento', async (req, res) => {
    const cliente = clienteAdmin();
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión como administrador.' });
    const acceso = await exigirAdmin(cliente, token);
    if ('status' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const { data, error } = await cliente
      .from('ia_contexto_documentos')
      .select('id,nombre,alcance,tipo_mime,tamano_bytes,caracteres,activo,creado_en,actualizado_en')
      .order('creado_en', { ascending: false });
    if (error) {
      console.error('[contexto_ia] No se pudo consultar la biblioteca:', error.message);
      return res.status(503).json({ error: 'La biblioteca de conocimiento aún no está disponible. Aplica la migración de LukApp.' });
    }
    return res.json({ documentos: data ?? [] });
  });

  rutas.post('/api/superadmin/ia/conocimiento', rateLimiter(8, 60000), async (req, res) => {
    const cliente = clienteAdmin();
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión como administrador.' });
    const acceso = await exigirAdmin(cliente, token);
    if ('status' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const { nombre, alcance, archivoBase64 } = req.body ?? {};
    if (typeof nombre !== 'string' || typeof alcance !== 'string' || !ALCANCES_DOCUMENTOS_IA.has(alcance as AlcanceDocumentoIA)
      || typeof archivoBase64 !== 'string') {
      return res.status(400).json({ error: 'Elige un documento y el tema al que pertenece.' });
    }
    // Los caracteres de control en un nombre de archivo rompen rutas y registros: se cambian a propósito.
    // oxlint-disable-next-line no-control-regex
    const nombreSeguro = path.basename(nombre.trim()).replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 180);
    const extension = path.extname(nombreSeguro).toLowerCase();
    const tiposPermitidos: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
    };
    if (!tiposPermitidos[extension]) return res.status(415).json({ error: 'Adjunta un PDF, TXT o Markdown (.md).' });
    const base64 = archivoBase64.replace(/^data:[^,]*;base64,/, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length > Math.ceil(MAX_BYTES_DOCUMENTO_IA * 4 / 3) + 8) {
      return res.status(413).json({ error: 'El archivo supera el límite de 4 MB o no tiene un formato válido.' });
    }
    const bytes = Buffer.from(base64, 'base64');
    if (!bytes.length || bytes.length > MAX_BYTES_DOCUMENTO_IA) {
      return res.status(413).json({ error: 'El archivo supera el límite de 4 MB o está vacío.' });
    }

    let contenido = '';
    if (extension === '.pdf') {
      let parser: PDFParse | null = null;
      try {
        parser = new PDFParse({ data: new Uint8Array(bytes) });
        contenido = (await parser.getText()).text;
      } catch {
        return res.status(422).json({ error: 'No se pudo extraer el texto del PDF. Revisa que no esté protegido.' });
      } finally {
        await parser?.destroy();
      }
    } else {
      contenido = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
    // pdf-parse a veces deja bytes nulos que Postgres rechaza en columnas de texto.
    // oxlint-disable-next-line no-control-regex
    contenido = contenido.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
    if (!contenido) return res.status(422).json({ error: 'El documento no contiene texto que se pueda consultar.' });
    if (contenido.length > MAX_CARACTERES_DOCUMENTO_IA) {
      return res.status(413).json({ error: 'El texto supera 150.000 caracteres. Divide el documento en archivos más pequeños.' });
    }

    const id = randomUUID();
    const rutaObjeto = `${id}/${nombreSeguro}`;
    const tipoMime = tiposPermitidos[extension];
    const fragmentos = cortarDocumentoEnFragmentos(contenido);
    const { error: errorSubida } = await cliente.storage.from('ia-contexto').upload(rutaObjeto, bytes, {
      contentType: tipoMime,
      upsert: false,
    });
    if (errorSubida) {
      console.error('[contexto_ia] No se pudo guardar el archivo privado:', errorSubida.message);
      return res.status(503).json({ error: 'No se pudo guardar el archivo privado. Revisa que exista el bucket ia-contexto.' });
    }

    const { error: errorDocumento } = await cliente.from('ia_contexto_documentos').insert({
      id,
      nombre: nombreSeguro,
      alcance,
      tipo_mime: tipoMime,
      tamano_bytes: bytes.length,
      caracteres: contenido.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      ruta_objeto: rutaObjeto,
      creado_por: acceso.userId,
      activo: false,
    });
    if (errorDocumento) {
      await cliente.storage.from('ia-contexto').remove([rutaObjeto]);
      console.error('[contexto_ia] No se pudo guardar la ficha:', errorDocumento.message);
      return res.status(503).json({ error: 'No se pudo registrar el documento. Revisa que la migración esté aplicada y que no exista ya.' });
    }

    const filas = fragmentos.map((fragmento, posicion) => ({
      documento_id: id,
      nombre_documento: nombreSeguro,
      alcance,
      posicion,
      contenido: fragmento,
    }));
    const { error: errorFragmentos } = await cliente.from('ia_contexto_fragmentos').insert(filas);
    if (errorFragmentos) {
      await cliente.storage.from('ia-contexto').remove([rutaObjeto]);
      await cliente.from('ia_contexto_documentos').delete().eq('id', id);
      console.error('[contexto_ia] No se pudieron indexar fragmentos:', errorFragmentos.message);
      return res.status(503).json({ error: 'No se pudo preparar el contenido para búsqueda.' });
    }

    return res.status(201).json({
      documento: { id, nombre: nombreSeguro, alcance, tipo_mime: tipoMime, tamano_bytes: bytes.length, caracteres: contenido.length, activo: false },
      vistaPrevia: contenido.slice(0, 700),
    });
  });

  rutas.patch('/api/superadmin/ia/conocimiento/:id', async (req, res) => {
    const cliente = clienteAdmin();
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión como administrador.' });
    const acceso = await exigirAdmin(cliente, token);
    if ('status' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id) || typeof req.body?.activo !== 'boolean') {
      return res.status(400).json({ error: 'El cambio de estado del documento no es válido.' });
    }
    const { error } = await cliente.from('ia_contexto_documentos')
      .update({ activo: req.body.activo, actualizado_en: new Date().toISOString() })
      .eq('id', req.params.id);
    if (error) return res.status(500).json({ error: 'No se pudo actualizar el documento.' });
    return res.json({ ok: true });
  });

  rutas.delete('/api/superadmin/ia/conocimiento/:id', async (req, res) => {
    const cliente = clienteAdmin();
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión como administrador.' });
    const acceso = await exigirAdmin(cliente, token);
    if ('status' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'El documento no es válido.' });
    const { data: documento, error: errorLectura } = await cliente.from('ia_contexto_documentos')
      .select('ruta_objeto').eq('id', req.params.id).maybeSingle();
    if (errorLectura) return res.status(503).json({ error: 'No se pudo consultar la biblioteca.' });
    if (!documento) return res.status(404).json({ error: 'El documento ya no existe.' });
    const { error: errorArchivo } = await cliente.storage.from('ia-contexto').remove([documento.ruta_objeto]);
    if (errorArchivo) return res.status(503).json({ error: 'No se pudo eliminar el archivo privado.' });
    const { error } = await cliente.from('ia_contexto_documentos').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: 'No se pudo retirar el documento de la biblioteca.' });
    return res.json({ ok: true });
  });

  return rutas;
};
