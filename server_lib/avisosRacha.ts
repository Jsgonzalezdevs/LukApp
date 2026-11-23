import { timingSafeEqual } from 'node:crypto';

export interface DestinoAviso {
  user_id: string;
  racha_actual: number;
  endpoint: string;
  suscripcion: unknown;
}

export interface CargaAviso {
  titulo: string;
  mensaje: string;
  etiqueta: string;
  url: string;
}

/**
 * Quien dispara el aviso es un cron externo, no una persona: se autoriza con
 * un secreto compartido. Sin secreto configurado la respuesta es siempre "no",
 * para que un servidor mal configurado no deje el endpoint abierto.
 */
export const cronAutorizado = (recibido: unknown, secreto: string | undefined): boolean => {
  if (!secreto || typeof recibido !== 'string') return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(secreto);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const cargaAvisoRacha = (racha: number): CargaAviso => ({
  titulo: `Tu racha de ${racha} días se apaga hoy 🔥`,
  mensaje: 'Anota un movimiento, aunque sea el tinto, y la salvas.',
  etiqueta: 'racha-riesgo',
  url: '/app',
});

export interface ResultadoAvisos {
  enviados: number;
  fallidos: number;
  depurados: number;
}

/**
 * Envía un aviso por cada suscripción. `enviar` devuelve el código HTTP del
 * servicio push cuando falla: 404 y 410 significan que el aparato ya no existe
 * y se borra su suscripción para no insistirle para siempre.
 */
export const enviarAvisosRacha = async (
  destinos: readonly DestinoAviso[],
  enviar: (destino: DestinoAviso, carga: CargaAviso) => Promise<void>,
  depurar: (destino: DestinoAviso) => Promise<void>,
): Promise<ResultadoAvisos> => {
  const resultado: ResultadoAvisos = { enviados: 0, fallidos: 0, depurados: 0 };
  for (const destino of destinos) {
    try {
      await enviar(destino, cargaAvisoRacha(destino.racha_actual));
      resultado.enviados += 1;
    } catch (error) {
      const codigo = (error as { statusCode?: number })?.statusCode;
      if (codigo === 404 || codigo === 410) {
        try {
          await depurar(destino);
          resultado.depurados += 1;
        } catch {
          resultado.fallidos += 1;
        }
      } else {
        resultado.fallidos += 1;
      }
    }
  }
  return resultado;
};
