import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, RotateCw, WifiOff } from 'lucide-react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const URL_LUKAPP = process.env.EXPO_PUBLIC_LUKAPP_WEB_URL || 'https://mi.lukapp.app/app';
const HOST_LUKAPP = new URL(URL_LUKAPP).hostname;
const FONDO = '#1a1817';
const MARCA_WEBVIEW = `
  window.__LUKAPP_NATIVE__ = true;
  if (document.documentElement) document.documentElement.setAttribute('data-native', 'true');
  (function () {
    var enviado = false;
    var observador = new MutationObserver(function () {
      if (enviado || !document.querySelector('#root button, #root input, #root nav')) return;
      enviado = true;
      observador.disconnect();
      window.ReactNativeWebView.postMessage('lukapp:lista');
    });
    observador.observe(document, { childList: true, subtree: true });
  })();
  true;
`;
const SINCRONIZAR_TEMA = `
  (function () {
    var raiz = document.documentElement;
    raiz.setAttribute('data-native', 'true');
    var bordeInferior = Number(window.__LUKAPP_SAFE_AREA_BOTTOM__);
    if (Number.isFinite(bordeInferior)) {
      raiz.style.setProperty('--lukapp-native-safe-area-bottom', bordeInferior + 'px');
    }
    var sistema = window.matchMedia('(prefers-color-scheme: dark)');
    var enviar = function () {
      var elegido = raiz.getAttribute('data-tema');
      var oscuro = elegido === 'oscuro' || (elegido !== 'claro' && sistema.matches);
      window.ReactNativeWebView.postMessage(JSON.stringify({ tipo: 'lukapp:tema', oscuro: oscuro, fondo: getComputedStyle(raiz).getPropertyValue('--fin-bg').trim() }));
    };
    new MutationObserver(enviar).observe(raiz, { attributes: true, attributeFilter: ['data-tema'] });
    sistema.addEventListener && sistema.addEventListener('change', enviar);
    enviar();
  })();
  true;
`;
const PUENTE_DESCARGAS = `
  (function () {
    if (!navigator.share) {
      navigator.share = function (datos) {
        return new Promise(function (resolver, rechazar) {
          var id = String(Date.now()) + Math.random().toString(36).slice(2);
          var recibir = function (evento) {
            if (!evento.detail || evento.detail.id !== id) return;
            window.removeEventListener('lukapp:compartido', recibir);
            if (evento.detail.error) rechazar(new Error(evento.detail.error));
            else resolver();
          };
          window.addEventListener('lukapp:compartido', recibir);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            tipo: 'lukapp:compartir', id: id, titulo: datos.title,
            texto: datos.text, url: datos.url
          }));
        });
      };
    }
    var archivos = new Map();
    var crearUrl = URL.createObjectURL.bind(URL);
    var clickEnlace = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function (contenido) {
      var url = crearUrl(contenido);
      archivos.set(url, contenido);
      return url;
    };
    HTMLAnchorElement.prototype.click = function () {
      var archivo = this.download ? archivos.get(this.href) : null;
      if (!archivo) return clickEnlace.call(this);
      var lector = new FileReader();
      lector.onload = function () {
        var resultado = String(lector.result || '');
        var base64 = resultado.slice(resultado.indexOf(',') + 1);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          tipo: 'lukapp:descarga',
          nombre: this.download || 'lukapp-exportacion',
          mime: archivo.type || 'application/octet-stream',
          base64: base64
        }));
        archivos.delete(this.href);
      }.bind(this);
      lector.onerror = function () {
        archivos.delete(this.href);
        window.ReactNativeWebView.postMessage(JSON.stringify({ tipo: 'lukapp:descarga-error' }));
      }.bind(this);
      lector.readAsDataURL(archivo);
    };
  })();
  true;
`;

export default function App() {
  const webView = useRef<WebView<{}>>(null);
  const puedeVolver = useRef(false);
  const [cargando, setCargando] = useState(true);
  const [falloConexion, setFalloConexion] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [fondo, setFondo] = useState(FONDO);
  const [estiloBarra, setEstiloBarra] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!puedeVolver.current) return false;
      webView.current?.goBack();
      return true;
    });
    return () => suscripcion.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setStyle(estiloBarra === 'light' ? 'dark' : 'light');
  }, [estiloBarra]);


  useEffect(() => {
    if (!cargando) return;
    const limite = setTimeout(() => {
      setCargando(false);
      setFalloConexion(true);
    }, 25_000);
    return () => clearTimeout(limite);
  }, [cargando, recarga]);

  const alCambiarNavegacion = (estado: WebViewNavigation) => {
    puedeVolver.current = estado.canGoBack;
  };

  const alRecibirMensaje = async (mensaje: string, origen: string) => {
    try {
      if (new URL(origen).hostname !== HOST_LUKAPP) return;
    } catch {
      return;
    }
    if (mensaje === 'lukapp:lista') {
      setCargando(false);
      setFalloConexion(false);
      return;
    }
    if (mensaje === 'lukapp:barra:clara') {
      setEstiloBarra('light');
      return;
    }
    if (mensaje === 'lukapp:barra:oscura') {
      setEstiloBarra('dark');
      return;
    }
    let archivo: { tipo?: string; nombre?: string; mime?: string; base64?: string; id?: string; titulo?: string; texto?: string; url?: string; oscuro?: boolean; fondo?: string };
    try {
      archivo = JSON.parse(mensaje);
    } catch {
      return;
    }
    if (archivo.tipo === 'lukapp:tema') {
      setEstiloBarra(archivo.oscuro ? 'light' : 'dark');
      if (archivo.fondo && /^#[0-9a-f]{3,8}$/i.test(archivo.fondo)) setFondo(archivo.fondo);
      return;
    }
    if (archivo.tipo === 'lukapp:compartir' && archivo.id) {
      let error: string | undefined;
      try {
        await Share.share({
          title: archivo.titulo,
          message: [archivo.texto, archivo.url].filter(Boolean).join('\n'),
        });
      } catch {
        error = 'No se pudo compartir. Inténtalo de nuevo.';
      }
      const detalle = JSON.stringify({ id: archivo.id, error });
      webView.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('lukapp:compartido', { detail: ${detalle} })); true;`);
      return;
    }
    if (archivo.tipo === 'lukapp:descarga-error') {
      Alert.alert('No se pudo preparar el archivo', 'Inténtalo de nuevo desde LukApp.');
      return;
    }
    if (archivo.tipo !== 'lukapp:descarga' || !archivo.base64) return;
    try {
      const carpeta = FileSystem.cacheDirectory;
      if (!carpeta) throw new Error('El almacenamiento temporal no está disponible.');
      const nombreSeguro = (archivo.nombre || 'lukapp-exportacion')
        .normalize('NFKD')
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .slice(0, 100);
      const uri = `${carpeta}${Date.now()}-${nombreSeguro || 'lukapp-exportacion'}`;
      await FileSystem.writeAsStringAsync(uri, archivo.base64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(uri, {
        mimeType: archivo.mime?.split(';')[0] || 'application/octet-stream',
        dialogTitle: `Guardar ${nombreSeguro || 'archivo de LukApp'}`,
      });
    } catch {
      Alert.alert('No se pudo guardar', 'Vuelve a intentarlo desde el menú de exportación de LukApp.');
    }
  };

  const permitirNavegacion = (solicitud: { url: string }) => {
    try {
      const url = new URL(solicitud.url);
      if (url.protocol === 'https:' || url.protocol === 'http:') return true;
      void Linking.openURL(solicitud.url).catch(() => undefined);
      return false;
    } catch {
      return false;
    }
  };

  const reintentar = () => {
    setFalloConexion(false);
    setCargando(true);
    setRecarga((actual) => actual + 1);
  };

  return (
    <SafeAreaView style={[estilos.pantalla, { backgroundColor: fondo }]} edges={['top']}>
      <StatusBar style={estiloBarra} />
      <WebView<{}>
        key={recarga}
        ref={webView}
        source={{ uri: URL_LUKAPP }}
        injectedJavaScriptBeforeContentLoaded={`window.__LUKAPP_SAFE_AREA_BOTTOM__ = 0; ${MARCA_WEBVIEW}`}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly
        injectedJavaScript={`${SINCRONIZAR_TEMA}${PUENTE_DESCARGAS}`}
        onMessage={(evento) => {
          void alRecibirMensaje(evento.nativeEvent.data, evento.nativeEvent.url);
        }}
        style={[estilos.web, { backgroundColor: fondo }]}
        containerStyle={[estilos.contenedorWeb, { backgroundColor: fondo }]}
        originWhitelist={['https://*', 'http://*', 'lukapp://*']}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures
        keyboardDisplayRequiresUserAction={false}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={permitirNavegacion}
        onNavigationStateChange={alCambiarNavegacion}
        onLoadStart={() => { setCargando(true); setFalloConexion(false); }}
        onLoadProgress={({ nativeEvent }) => {
          if (nativeEvent.progress >= 0.9) setCargando(false);
        }}
        onLoadEnd={() => { webView.current?.injectJavaScript(`${SINCRONIZAR_TEMA} true;`); setCargando(false); }}
        onHttpError={({ nativeEvent }) => {
          if (nativeEvent.url === URL_LUKAPP && nativeEvent.statusCode >= 400) {
            setCargando(false);
            setFalloConexion(true);
          }
        }}
        onRenderProcessGone={() => { setCargando(false); setFalloConexion(true); }}
        onError={() => { setCargando(false); setFalloConexion(true); }}
      />

      {cargando && !falloConexion ? (
        <View pointerEvents="none" style={[estilos.cargando, { backgroundColor: fondo }]}>
          <ActivityIndicator color="#F0AC26" size="small" />
        </View>
      ) : null}

      {falloConexion ? (
        <View style={[estilos.error, { backgroundColor: fondo }]}>
          <View style={estilos.iconoError}><WifiOff color="#F1C15E" size={23} /></View>
          <Text style={[estilos.tituloError, { color: estiloBarra === 'dark' ? '#1c1917' : '#F5F3F0' }]}>No pudimos conectar con LukApp</Text>
          <Text style={[estilos.detalleError, { color: estiloBarra === 'dark' ? '#6b625b' : '#B2ABA4' }]}>Revisa tu conexión e inténtalo de nuevo.</Text>
          <Pressable onPress={reintentar} style={estilos.botonReintentar} accessibilityRole="button">
            <RotateCw color="#24180C" size={17} />
            <Text style={estilos.textoReintentar}>Intentar de nuevo</Text>
          </Pressable>
          {puedeVolver.current ? (
            <Pressable onPress={() => webView.current?.goBack()} style={estilos.botonVolver} accessibilityRole="button">
              <ArrowLeft color="#F5F3F0" size={16} />
              <Text style={[estilos.textoVolver, { color: estiloBarra === 'dark' ? '#1c1917' : '#F5F3F0' }]}>Volver</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: FONDO },
  contenedorWeb: { flex: 1, backgroundColor: FONDO },
  web: { flex: 1, backgroundColor: FONDO },
  cargando: {
    ...StyleSheet.absoluteFill,
    bottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FONDO,
  },
  error: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: FONDO,
  },
  iconoError: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#29241D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 19,
  },
  tituloError: { color: '#F5F3F0', fontSize: 19, fontWeight: '700', textAlign: 'center' },
  detalleError: { color: '#B2ABA4', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9 },
  botonReintentar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#F0AC26',
    marginTop: 24,
  },
  textoReintentar: { color: '#24180C', fontSize: 14, fontWeight: '700' },
  botonVolver: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, marginTop: 8 },
  textoVolver: { color: '#F5F3F0', fontSize: 13, fontWeight: '600' },
});
