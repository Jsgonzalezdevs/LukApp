/**
 * Hook for managing values in localStorage with memoization.
 * Prevents unnecessary re-renders and repeated localStorage access.
 */

import { useCallback, useRef, useState } from 'react';

/**
 * Hook to manage a value in localStorage.
 *
 * @param key - localStorage key
 * @param initial - Initial value if key not found
 * @param options - Optional config (serialize/deserialize functions)
 * @returns [value, setValue] tuple
 *
 * Example:
 * ```
 * const [tipsMinimized, setTipsMinimized] = useLocalStorageValue('tips-min', false);
 * // value is memoized in memory, localStorage only accessed on mount
 * ```
 */
export function useLocalStorageValue<T>(
  key: string,
  initial: T,
  options?: {
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  },
): [T, (value: T) => void] {
  const serializeRef = useRef(options?.serialize ?? ((v: T) => JSON.stringify(v)));
  serializeRef.current = options?.serialize ?? ((v: T) => JSON.stringify(v));

  const deserialize = options?.deserialize ?? ((v: string) => JSON.parse(v) as T);

  // Load from localStorage on mount only
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        return deserialize(stored);
      }
    } catch {
      // Safari private mode, localStorage disabled, or parse error
      // Silently fall back to initial value
    }
    return initial;
  });

  // Wrap setValue to persist to localStorage
  const setAndStore = useCallback(
    (newValue: T) => {
      setValue(newValue);
      try {
        localStorage.setItem(key, serializeRef.current(newValue));
      } catch {
        // Safari private mode or storage quota exceeded
        // Continue anyway - value is at least in memory
      }
    },
    [key],
  );

  return [value, setAndStore];
}

/**
 * Hook for string values in localStorage.
 *
 * @param key - localStorage key
 * @param initial - Initial value
 * @returns [value, setValue] tuple
 *
 * Example:
 * ```
 * const [email, setEmail] = useLocalStorageString('saved-email', '');
 * ```
 */
export function useLocalStorageString(key: string, initial: string = ''): [string, (value: string) => void] {
  return useLocalStorageValue(key, initial, {
    serialize: (v) => v,
    deserialize: (v) => v,
  });
}

/**
 * Hook for boolean values in localStorage.
 *
 * @param key - localStorage key
 * @param initial - Initial value
 * @returns [value, setValue] tuple
 *
 * Example:
 * ```
 * const [rememberMe, setRememberMe] = useLocalStorageBoolean('remember-me', true);
 * ```
 */
export function useLocalStorageBoolean(key: string, initial: boolean = false): [boolean, (value: boolean) => void] {
  return useLocalStorageValue(key, initial, {
    serialize: (v) => String(v),
    deserialize: (v) => v === 'true',
  });
}

/**
 * Hook for number values in localStorage.
 *
 * @param key - localStorage key
 * @param initial - Initial value
 * @returns [value, setValue] tuple
 *
 * Example:
 * ```
 * const [count, setCount] = useLocalStorageNumber('visit-count', 0);
 * ```
 */
export function useLocalStorageNumber(key: string, initial: number = 0): [number, (value: number) => void] {
  return useLocalStorageValue(key, initial, {
    serialize: (v) => String(v),
    deserialize: (v) => Number(v) || initial,
  });
}
