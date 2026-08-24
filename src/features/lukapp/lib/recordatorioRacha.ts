const CLAVE_ULTIMO_ENVIO = 'finanzas:recordatorio-racha:ultimo-envio';

/**
 * Solicita permisos de notificación nativos al usuario en el navegador / PWA.
 */
export const solicitarPermisoNotificaciones = async (): Promise<NotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return 'denied';
  }
};

/**
 * Consulta el estado actual de permisos de notificación.
 */
export const obtenerEstadoPermiso = (): NotificationPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
};

/**
 * Emite una notificación nativa de recordatorio de racha.
 */
export const enviarNotificacionRacha = async (
  rachaActual: number,
  esPrueba: boolean = false,
): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const titulo = esPrueba
    ? '✅ ¡Recordatorio de racha activado!'
    : rachaActual > 0
      ? `🔥 ¡No pierdas tu racha de ${rachaActual} ${rachaActual === 1 ? 'día' : 'días'}!`
      : '🔥 ¡Hora de registrar tus finanzas de hoy!';

  const opciones: NotificationOptions = {
    body: esPrueba
      ? 'Así se verán tus recordatorios diarios en LukApp para no perder tu consistencia.'
      : 'Aún no has registrado tus gastos de hoy. Toca aquí para anotar en 5 segundos.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'recordatorio-racha',
    data: { url: '/app' },
  };

  try {
    // Intentar mostrar a través del Service Worker de la PWA
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(titulo, opciones);
        return true;
      }
    }
    // Fallback estándar en navegador
    new Notification(titulo, opciones);
    return true;
  } catch (err) {
    console.warn('Error al mostrar notificación de racha:', err);
    return false;
  }
};

/**
 * Verifica si es el momento adecuado para recordar la racha al usuario.
 */
export const verificarRecordatorioRacha = async (
  activo: boolean,
  horaConfigurada: string, // "20:30"
  anotadoHoy: boolean,
  rachaActual: number,
  hoy: string, // "2026-08-24"
): Promise<boolean> => {
  if (!activo || anotadoHoy || typeof window === 'undefined') {
    return false;
  }
  if (obtenerEstadoPermiso() !== 'granted') {
    return false;
  }

  // Verificar si ya se envió una notificación hoy
  try {
    const ultimoEnvio = localStorage.getItem(CLAVE_ULTIMO_ENVIO);
    if (ultimoEnvio === hoy) {
      return false;
    }
  } catch {
    // Ignorar error de storage
  }

  // Comprobar la hora local actual
  const ahora = new Date();
  const [horaMeta, minutoMeta] = horaConfigurada.split(':').map(Number);
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const minutosObjetivo = (horaMeta || 20) * 60 + (minutoMeta || 30);

  // Si ya llegó o pasó la hora objetivo (por ejemplo después de las 8:30 PM)
  if (minutosAhora >= minutosObjetivo) {
    const enviado = await enviarNotificacionRacha(rachaActual, false);
    if (enviado) {
      try {
        localStorage.setItem(CLAVE_ULTIMO_ENVIO, hoy);
      } catch {
        // Ignorar
      }
    }
    return enviado;
  }

  return false;
};
