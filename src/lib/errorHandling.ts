/**
 * Centralized error handling with retry logic and consistent error classification.
 */

export type ErrorType = 'network' | 'validation' | 'auth' | 'notfound' | 'unknown';

export interface ErrorInfo {
  message: string;
  type: ErrorType;
  originalError?: unknown;
}

/**
 * Classify error by type for better handling and UX.
 */
export function classifyError(error: unknown, context: string): ErrorInfo {
  if (error instanceof TypeError) {
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return {
        message: 'Error de conexión. Verifica tu internet.',
        type: 'network',
        originalError: error,
      };
    }
    return {
      message: `Datos inválidos en ${context}`,
      type: 'validation',
      originalError: error,
    };
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('401') || msg.includes('unauthorized')) {
      return {
        message: 'Sesión expirada. Vuelve a entrar.',
        type: 'auth',
        originalError: error,
      };
    }
    if (msg.includes('404') || msg.includes('not found')) {
      return {
        message: 'Recurso no encontrado.',
        type: 'notfound',
        originalError: error,
      };
    }
    if (msg.includes('network') || msg.includes('offline')) {
      return {
        message: 'Sin conexión. Intenta más tarde.',
        type: 'network',
        originalError: error,
      };
    }
  }

  const errorStr = String(error);
  if (errorStr.includes('network') || errorStr.includes('offline')) {
    return {
      message: 'Error de conexión.',
      type: 'network',
      originalError: error,
    };
  }

  return {
    message: `Error desconocido en ${context}. Intenta de nuevo.`,
    type: 'unknown',
    originalError: error,
  };
}

/**
 * Execute action with exponential backoff retry logic.
 *
 * @param action - Async function to execute
 * @param maxAttempts - Maximum number of attempts (default: 3)
 * @param onRetry - Callback when retrying (attempt number)
 * @returns Result of action if successful
 * @throws ErrorInfo if all attempts fail
 *
 * Example:
 * ```
 * const data = await conReintentos(
 *   () => fetch('/api/usuarios').then(r => r.json()),
 *   3,
 *   (intento) => console.log(`Reintentando... intento ${intento}`)
 * );
 * ```
 */
export async function conReintentos<T>(
  action: () => Promise<T>,
  maxAttempts: number = 3,
  onRetry?: (attempt: number, error: unknown) => void,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        break;
      }

      // Only retry on network errors, not validation errors
      const errorInfo = classifyError(error, 'reintento');
      if (errorInfo.type === 'validation' || errorInfo.type === 'auth' || errorInfo.type === 'notfound') {
        // Don't retry these errors, fail fast
        throw error;
      }

      onRetry?.(attempt, error);

      // Exponential backoff: 1s, 2s, 4s, capped at 30s
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Safe async operation with error handling and logging.
 *
 * @param fn - Async function to execute
 * @param context - Context string for error messages
 * @param onError - Optional error callback
 * @returns [result, error] tuple for safe error handling
 *
 * Example:
 * ```
 * const [data, error] = await ejecutarSeguro(
 *   () => fetch('/api/datos').then(r => r.json()),
 *   'cargar datos'
 * );
 * if (error) showNotification(error.message);
 * ```
 */
export async function ejecutarSeguro<T>(
  fn: () => Promise<T>,
  context: string,
  onError?: (error: ErrorInfo) => void,
): Promise<[T | null, ErrorInfo | null]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    const errorInfo = classifyError(error, context);
    onError?.(errorInfo);
    if (import.meta.env.DEV) {
      console.error(`[${context}]`, errorInfo);
    }
    return [null, errorInfo];
  }
}

/**
 * Create a retry wrapper for an async function.
 *
 * @param fn - Async function to wrap
 * @param maxAttempts - Max retry attempts
 * @returns Function that auto-retries
 *
 * Example:
 * ```
 * const fetchWithRetry = conReintentosEnvoltura(
 *   () => fetch('/api/usuarios'),
 *   3
 * );
 * const response = await fetchWithRetry();
 * ```
 */
export function conReintentosEnvoltura<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  maxAttempts: number = 3,
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    return conReintentos(
      () => fn(...args),
      maxAttempts,
    );
  };
}
