import { createHmac, timingSafeEqual } from 'node:crypto';

interface CabecerasFirmaResend {
  secreto: string | undefined;
  id: string | undefined;
  marcaTiempo: string | undefined;
  firmas: string | undefined;
  cuerpo: Buffer | undefined;
  ahoraMs?: number;
}

/** Resend/Svix firma id, timestamp y cuerpo crudo; limita reenvíos antiguos. */
export const validarFirmaWebhookResend = ({ secreto, id, marcaTiempo, firmas, cuerpo, ahoraMs = Date.now() }: CabecerasFirmaResend): boolean => {
  if (!secreto || !id || !marcaTiempo || !firmas || !cuerpo) return false;
  const marca = Number(marcaTiempo);
  if (!Number.isFinite(marca) || Math.abs(ahoraMs / 1000 - marca) > 5 * 60) return false;
  const clave = Buffer.from(secreto.replace(/^whsec_/, ''), 'base64');
  if (!clave.length) return false;
  const esperado = createHmac('sha256', clave).update(`${id}.${marcaTiempo}.${cuerpo.toString('utf8')}`).digest();
  return firmas.split(' ').some((firma) => {
    const valor = firma.split(',')[1];
    if (!valor) return false;
    try {
      const recibido = Buffer.from(valor, 'base64');
      return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
    } catch { return false; }
  });
};
