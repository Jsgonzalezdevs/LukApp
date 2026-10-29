import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const TROZO_MAXIMO = 1700;
const separadorClave = '.';

/**
 * Supabase forma su clave de almacenamiento a partir de la URL del proyecto.
 * Expo SecureStore solo admite letras, números, punto, guion y guion bajo.
 * Escapamos cada carácter ajeno al alfabeto permitido para que la conversión
 * sea estable e inequívoca entre lecturas, escrituras y borrados.
 */
function normalizarClave(clave: string) {
  return `lukapp.auth.${Array.from(clave, (caracter) => {
    if (/^[A-Za-z0-9.-]$/.test(caracter)) return caracter;
    return `_${caracter.codePointAt(0)!.toString(16)}_`;
  }).join('')}`;
}

/**
 * Las sesiones incluyen tokens privados. Se guardan cifradas con Android
 * Keystore; se dividen para caber en los límites de tamaño del almacenamiento
 * seguro. El índice se escribe al final para no publicar sesiones incompletas.
 */
const almacenamientoSeguro = {
  async getItem(clave: string) {
    const claveAlmacenada = normalizarClave(clave);
    const indice = await SecureStore.getItemAsync(claveAlmacenada);
    if (!indice) return null;
    const [generacion, cantidadTexto] = indice.split(':');
    const cantidad = Number(cantidadTexto);
    if (!generacion || !Number.isInteger(cantidad) || cantidad < 1) return null;
    const partes = await Promise.all(
      Array.from({ length: cantidad }, (_, i) =>
        SecureStore.getItemAsync(`${claveAlmacenada}${separadorClave}${generacion}${separadorClave}${i}`),
      ),
    );
    if (partes.some((parte) => parte === null)) return null;
    return partes.join('');
  },
  async setItem(clave: string, valor: string) {
    const claveAlmacenada = normalizarClave(clave);
    const anterior = await SecureStore.getItemAsync(claveAlmacenada);
    const generacion = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const partes = valor.match(new RegExp(`.{1,${TROZO_MAXIMO}}`, 'gs')) ?? [''];
    await Promise.all(
      partes.map((parte, i) =>
        SecureStore.setItemAsync(`${claveAlmacenada}${separadorClave}${generacion}${separadorClave}${i}`, parte),
      ),
    );
    await SecureStore.setItemAsync(claveAlmacenada, `${generacion}:${partes.length}`);
    if (anterior) {
      const [generacionAnterior, cantidadTexto] = anterior.split(':');
      const cantidadAnterior = Number(cantidadTexto);
      if (generacionAnterior && Number.isInteger(cantidadAnterior)) {
        await Promise.all(
          Array.from({ length: cantidadAnterior }, (_, i) =>
            SecureStore.deleteItemAsync(`${claveAlmacenada}${separadorClave}${generacionAnterior}${separadorClave}${i}`),
          ),
        );
      }
    }
  },
  async removeItem(clave: string) {
    const claveAlmacenada = normalizarClave(clave);
    const indice = await SecureStore.getItemAsync(claveAlmacenada);
    await SecureStore.deleteItemAsync(claveAlmacenada);
    if (!indice) return;
    const [generacion, cantidadTexto] = indice.split(':');
    const cantidad = Number(cantidadTexto);
    if (generacion && Number.isInteger(cantidad)) {
      await Promise.all(
        Array.from({ length: cantidad }, (_, i) =>
          SecureStore.deleteItemAsync(`${claveAlmacenada}${separadorClave}${generacion}${separadorClave}${i}`),
        ),
      );
    }
  },
};

export const supabase = url && publishableKey
  ? createClient(url, publishableKey, {
      auth: {
        storage: almacenamientoSeguro,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
