import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validarFirmaWebhookResend } from './firmaWebhookResend';

describe('firma del webhook de Resend', () => {
  const secret = `whsec_${Buffer.from('llave-de-prueba').toString('base64')}`;
  const ahoraMs = 1_800_000_000_000;
  const id = 'evt-prueba';
  const timestamp = String(ahoraMs / 1000);
  const body = Buffer.from('{"type":"email.received"}');
  const signature = `v1,${createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`${id}.${timestamp}.${body.toString('utf8')}`).digest('base64')}`;

  it('acepta firma válida sobre los bytes originales', () => {
    expect(validarFirmaWebhookResend({ secreto: secret, id, marcaTiempo: timestamp, firmas: signature, cuerpo: body, ahoraMs })).toBe(true);
  });

  it('rechaza cuerpo modificado, firma ausente y evento vencido', () => {
    expect(validarFirmaWebhookResend({ secreto: secret, id, marcaTiempo: timestamp, firmas: signature, cuerpo: Buffer.from('{}'), ahoraMs })).toBe(false);
    expect(validarFirmaWebhookResend({ secreto: secret, id, marcaTiempo: timestamp, firmas: undefined, cuerpo: body, ahoraMs })).toBe(false);
    expect(validarFirmaWebhookResend({ secreto: secret, id, marcaTiempo: String(Number(timestamp) - 301), firmas: signature, cuerpo: body, ahoraMs })).toBe(false);
  });
});
