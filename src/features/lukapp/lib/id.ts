/** Los ids siguen siendo UUID válidos al probar desde una IP de la red local. */
export const nuevoId = (_prefijo = 'id'): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const texto = Array.from(bytes, (valor) => valor.toString(16).padStart(2, '0')).join('');
  return `${texto.slice(0, 8)}-${texto.slice(8, 12)}-${texto.slice(12, 16)}-${texto.slice(16, 20)}-${texto.slice(20)}`;
};

/** El Efectivo automático es el mismo en todos los dispositivos de una cuenta. */
export const idEfectivoParaUsuario = async (usuario: string): Promise<string> => {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`lukapp:efectivo:${usuario}`));
  const bytes = new Uint8Array(hash).slice(0, 16);
  // UUID v8: identificador derivado propio, sin compartir el UUID entre usuarios.
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const texto = Array.from(bytes, (valor) => valor.toString(16).padStart(2, '0')).join('');
  return `${texto.slice(0, 8)}-${texto.slice(8, 12)}-${texto.slice(12, 16)}-${texto.slice(16, 20)}-${texto.slice(20)}`;
};
