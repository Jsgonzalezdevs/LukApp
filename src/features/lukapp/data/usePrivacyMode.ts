/**
 * Privacy mode preference - separated from general preferences for clarity.
 * Controls whether sensitive financial information is masked on screen.
 */

import { useEffect } from 'react';
import { useLocalStorageBoolean } from '../hooks/useLocalStorageValue';
import { obtenerSupabase } from './supabase';

const STORAGE_KEY = 'finanzas:modo-privacidad';

/**
 * Hook for privacy mode setting.
 * When enabled, sensitive data (amounts, names, etc) are masked on screen.
 *
 * @returns [privacyMode, setPrivacyMode] - privacy mode enabled and setter
 *
 * Example:
 * ```
 * const [privacyMode, setPrivacyMode] = useModoPrivacidad();
 * if (privacyMode) {
 *   // Render masked version
 * }
 * ```
 */
export function useModoPrivacidad(): [boolean, (value: boolean) => void] {
  const [privacyMode, setPrivacyMode] = useLocalStorageBoolean(STORAGE_KEY, false);

  // Sync to Supabase when changed
  useEffect(() => {
    const syncToSupabase = async () => {
      try {
        const supabase = obtenerSupabase();
        if (supabase) {
          await supabase.auth.updateUser({
            data: { [STORAGE_KEY]: privacyMode },
          });
        }
      } catch {
        // Ignore errors - offline is okay, will sync later
      }
    };

    syncToSupabase();
  }, [privacyMode]);

  return [privacyMode, setPrivacyMode];
}
