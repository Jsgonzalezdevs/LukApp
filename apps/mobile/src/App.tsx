import { useGrabacionNativa } from './useGrabacionNativa';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Linking,
  Platform,
  PermissionsAndroid,
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
import * as WebBrowser from 'expo-web-browser';

/** Debe coincidir con REDIRECCION_NATIVA de la web y estar en Auth → URL Configuration. */
const REDIRECCION_GOOGLE = 'lukapp://auth/callback';
const URL_LUKAPP = process.env.EXPO_PUBLIC_LUKAPP_WEB_URL || 'https://mi.lukapp.app/app';
const HOST_LUKAPP = new URL(URL_LUKAPP).hostname;
const FONDO = '#1a1817';
const MARCA_WEBVIEW = `
  window.__LUKAPP_NATIVE__ = true;
  window.__LUKAPP_AUDIO_NATIVE__ = true;
  if (document.documentElement) document.documentElement.setAttribute('data-native', 'true');
  (function () {
    // Avisa una sola vez, cuando React ya pintó algo tocable, y se desconecta:
    // dejarlo escuchando cada cambio del DOM solo gastaba batería.
    var observador = new MutationObserver(function () {
      if (!document.querySelector('#root button, #root input, #root nav')) return;
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
const PUENTE_MICROFONO = `
  (function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    var original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function (opciones) {
      if (opciones.audio) await new Promise(function (resolver, rechazar) {
        var id = String(Date.now());
        var recibir = function (evento) {
          if (!evento.detail || evento.detail.id !== id) return;
          clearTimeout(limite);
          window.removeEventListener('lukapp:microfono', recibir);
          if (evento.detail.concedido) resolver();
          else rechazar(new DOMException('Permite el micrófono en Ajustes de Android → LukApp.', 'NotAllowedError'));
        };
        var limite = setTimeout(function () {
          window.removeEventListener('lukapp:microfono', recibir);
          rechazar(new DOMException('No se pudo confirmar el permiso del micrófono.', 'NotAllowedError'));
        }, 60000);
        window.addEventListener('lukapp:microfono', recibir);
        window.ReactNativeWebView.postMessage(JSON.stringify({ tipo: 'lukapp:microfono', id: id }));
      });
      return original(opciones);
    };
  })(); true;
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
  const grabarNativo = useGrabacionNativa((detalle) => {
    webView.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('lukapp:audio-nativo', { detail: ${JSON.stringify(detalle)} })); true;`);
  });
  const puedeVolver = useRef(false);
  const [cargando, setCargando] = useState(true);
  const [falloConexion, setFalloConexion] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [fondo, setFondo] = useState(FONDO);
  const [estiloBarra, setEstiloBarra] = useState<'light' | 'dark'>('light');
  const [, setPuedeVolverVisible] = useState(false);
  /** Si el HTML llegó, la red funciona aunque React tarde en pintar. */
  const htmlCargado = useRef(false);

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
      if (!htmlCargado.current) setFalloConexion(true);
    }, 25_000);
    return () => clearTimeout(limite);
  }, [cargando, recarga]);

  const alCambiarNavegacion = (estado: WebViewNavigation) => {
    puedeVolver.current = estado.canGoBack;
    setPuedeVolverVisible(estado.canGoBack);
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
    let archivo: { tipo?: string; nombre?: string; mime?: string; base64?: string; id?: string; titulo?: string; texto?: string; url?: string; accion?: string; oscuro?: boolean; fondo?: string };
    try {
      archivo = JSON.parse(mensaje);
    } catch {
      return;
    }
    if (archivo.tipo === 'lukapp:google' && archivo.url) {
      void entrarConGoogle(archivo.url);
      return;
    }
    if (archivo.tipo === 'lukapp:audio-nativo' && archivo.id && archivo.accion) {
      grabarNativo(archivo.id, archivo.accion);
      return;
    }
    if (archivo.tipo === 'lukapp:microfono' && archivo.id) {
      const concedido = Platform.OS !== 'android' ||
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) === PermissionsAndroid.RESULTS.GRANTED;
      webView.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('lukapp:microfono', { detail: ${JSON.stringify({ id: archivo.id, concedido })} })); true;`);
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

  /**
   * Google no deja iniciar sesión dentro de un WebView, así que el enlace que
   * prepara la web se abre en el navegador del sistema. Los tokens vuelven por
   * `lukapp://auth/callback` y se le entregan a la web recargándola con ellos
   * en la URL: su cliente de Supabase los detecta y guarda la sesión.
   */
  const entrarConGoogle = async (enlace: string) => {
    try {
      const destino = new URL(enlace);
      // Solo se abre el autorizador de Supabase, nunca una URL arbitraria.
      if (destino.protocol !== 'https:' || !destino.pathname.endsWith('/auth/v1/authorize')) return;
      const resultado = await WebBrowser.openAuthSessionAsync(enlace, REDIRECCION_GOOGLE);
      if (resultado.type !== 'success') return;
      const vuelta = new URL(resultado.url);
      const web = new URL(URL_LUKAPP);
      web.search = vuelta.search;
      web.hash = vuelta.hash;
      webView.current?.injectJavaScript(`window.location.replace(${JSON.stringify(web.toString())}); true;`);
    } catch {
      Alert.alert('No se pudo entrar con Google', 'Inténtalo de nuevo o entra con tu correo.');
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
    htmlCargado.current = false;
    setFalloConexion(false);
    setCargando(true);
    setRecarga((actual) => actual + 1);
  };

  return (
    <SafeAreaView style={[estilos.pantalla, { backgroundColor: fondo }]} edges={['top', 'bottom']}>
      <StatusBar style={estiloBarra} />
      <WebView<{}>
        key={recarga}
        ref={webView}
        source={{ uri: URL_LUKAPP }}
        injectedJavaScriptBeforeContentLoaded={`window.__LUKAPP_SAFE_AREA_BOTTOM__ = 0; ${MARCA_WEBVIEW}`}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly
        injectedJavaScript={`${SINCRONIZAR_TEMA}${PUENTE_MICROFONO}${PUENTE_DESCARGAS}`}
        onMessage={(evento) => {
          void alRecibirMensaje(evento.nativeEvent.data, evento.nativeEvent.url);
        }}
        style={[estilos.web, { backgroundColor: fondo }]}
        containerStyle={[estilos.contenedorWeb, { backgroundColor: fondo }]}
        originWhitelist={['https://*', 'http://*', 'lukapp://*']}
        applicationNameForUserAgent="LukAppNativeAudio/1"
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures
        keyboardDisplayRequiresUserAction={false}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={permitirNavegacion}
        onNavigationStateChange={alCambiarNavegacion}
        // Android dispara onLoadStart en cada cambio de ruta interno (pushState),
        // no solo al cargar la página. Si aquí se volviera a tapar la web, tocar
        // la billetera dejaba la pantalla de carga puesta hasta el límite de
        // tiempo y terminaba en un falso «No pudimos conectar».
        onLoadEnd={({ nativeEvent }) => {
          if (!nativeEvent.loading) htmlCargado.current = true;
          webView.current?.injectJavaScript(`${SINCRONIZAR_TEMA} true;`);
        }}
        onHttpError={({ nativeEvent }) => {
          if (nativeEvent.url === URL_LUKAPP && nativeEvent.statusCode >= 400) {
            setCargando(false);
            setFalloConexion(true);
          }
        }}
        onRenderProcessGone={() => { setCargando(false); setFalloConexion(true); }}
        onError={() => { htmlCargado.current = false; setCargando(false); setFalloConexion(true); }}
      />

      {cargando && !falloConexion ? (
        <View pointerEvents="none" style={[estilos.cargando, { backgroundColor: fondo }]} accessibilityRole="progressbar" accessibilityLabel="Abriendo LukApp">
          <Image source={require('../assets-app-icon-square.png')} style={estilos.logoCarga} />
          <ActivityIndicator style={estilos.indicadorCarga} color="#F0AC26" />
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
            <Pressable onPress={() => { setFalloConexion(false); webView.current?.goBack(); }} style={estilos.botonVolver} accessibilityRole="button">
              <ArrowLeft color={estiloBarra === 'dark' ? '#1c1917' : '#F5F3F0'} size={16} />
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCarga: { width: 64, height: 64, borderRadius: 20 },
  indicadorCarga: { marginTop: 22 },
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
