import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  Alert,
  KeyboardAvoidingView,
  Image,
  type ImageStyle,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  Home,
  List,
  LockKeyhole,
  Mail,
  Plus,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react-native';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { VERSION } from '../../../src/version';
import { supabase } from './lib/supabase';
import { RepositorioSupabase } from '../../../src/features/lukapp/data/repositorioSupabase';
import type { Instantanea } from '../../../src/features/lukapp/data/repositorio';
import type { Transaction, TxKind } from '../../../src/features/lukapp/types';
import { ES_PASIVO, TIPO_LABELS, type CajitaTipo } from '../../../src/features/lukapp/data/modelos';
import { bogotaDate, monthKey, monthKeyLabel } from '../../../src/features/lukapp/lib/localDate';
import { monthTotals, forMonth } from '../../../src/features/lukapp/lib/aggregate';
import { patrimonio, resumenDeCajitas } from '../../../src/features/lukapp/lib/cajitas';
import { formatCop, formatAmountInput, parseAmountInput } from '../../../src/features/lukapp/lib/formatCop';
import { nuevoId } from '../../../src/features/lukapp/lib/id';
import { CATEGORY_LABELS } from '../../../src/features/lukapp/types';

type Modo = 'entrar' | 'crear' | 'recuperar' | 'actualizar';
type EstadoApodo = 'vacio' | 'corto' | 'comprobando' | 'libre' | 'ocupado' | 'sin-verificar';

const traducirError = (error: unknown) => {
  const original = error instanceof Error ? error.message : '';
  const mensaje = original.toLowerCase();
  if (mensaje.includes('invalid login credentials')) return 'El correo o la contraseña no coinciden.';
  if (mensaje.includes('email not confirmed')) return 'Confirma tu correo antes de iniciar sesión.';
  if (mensaje.includes('user already registered')) return 'Ya existe una cuenta con ese correo. Entra con tu contraseña.';
  if (mensaje.includes('password should be at least')) return 'La contraseña debe tener al menos 8 caracteres.';
  if (mensaje.includes('rate limit') || mensaje.includes('too many requests')) return 'Hubo varios intentos seguidos. Espera un momento y vuelve a intentarlo.';
  if (mensaje.includes('network') || mensaje.includes('fetch failed')) return 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.';
  return original || 'No fue posible conectar con LukApp.';
};

const colores = {
  fondo: '#101014',
  panel: '#1B1A1D',
  campo: '#131214',
  borde: '#343039',
  texto: '#F7F4F8',
  tenue: '#A9A3AD',
  oro: '#F0AC26',
  morado: '#8B46DF',
};

const ETIQUETAS_GRUPO_DINERO: Record<CajitaTipo, string> = {
  cuenta: 'Cuentas',
  cajita: 'Ahorros',
  deuda: 'Deudas',
  tarjeta: 'Tarjetas',
};

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [modo, setModo] = useState<Modo>('entrar');
  const [correo, setCorreo] = useState('');
  const [apodo, setApodo] = useState('');
  const [estadoApodo, setEstadoApodo] = useState<EstadoApodo>('vacio');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const enlaceDeepLink = Linking.useLinkingURL();
  const ultimoEnlace = useRef('');
  const redirectUri = makeRedirectUri({ path: 'auth/callback' });

  useEffect(() => {
    if (!supabase) return;
    let activa = true;
    supabase.auth.getSession().then(({ data }) => {
      if (activa) setSesion(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSesion(nuevaSesion);
    });
    return () => {
      activa = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const procesarEnlaceAuth = async (url: string) => {
    if (!supabase || ultimoEnlace.current === url) return;
    ultimoEnlace.current = url;
    try {
      const parametros = new URLSearchParams(new URL(url).search);
      new URLSearchParams(new URL(url).hash.slice(1)).forEach((valor, clave) => parametros.set(clave, valor));
      const errorCode = parametros.get('error_code') || parametros.get('error');
      if (errorCode) throw new Error(parametros.get('error_description') || errorCode);
      const accessToken = parametros.get('access_token');
      const refreshToken = parametros.get('refresh_token');
      if (!accessToken || !refreshToken) return;
      if (parametros.get('type') === 'recovery') setModo('actualizar');
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw error;
    } catch (fallo) {
      setMensaje(traducirError(fallo));
    }
  };

  useEffect(() => {
    if (enlaceDeepLink?.startsWith('lukapp://auth/callback')) void procesarEnlaceAuth(enlaceDeepLink);
  }, [enlaceDeepLink]);

  useEffect(() => {
    if (modo !== 'crear') {
      setEstadoApodo('vacio');
      return;
    }
    const limpio = apodo.trim();
    if (!limpio) {
      setEstadoApodo('vacio');
      return;
    }
    if (limpio.length < 3) {
      setEstadoApodo('corto');
      return;
    }
    const cliente = supabase;
    if (!cliente) {
      setEstadoApodo('sin-verificar');
      return;
    }
    setEstadoApodo('comprobando');
    let vigente = true;
    const temporizador = setTimeout(async () => {
      const { data, error } = await cliente.rpc('usuario_disponible', { nombre: limpio });
      if (!vigente) return;
      setEstadoApodo(error ? 'sin-verificar' : data ? 'libre' : 'ocupado');
    }, 450);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [apodo, modo]);

  const autenticar = async () => {
    if (!supabase) {
      setMensaje('Falta conectar las variables públicas de Supabase para probar el acceso.');
      return;
    }
    if (modo === 'recuperar') {
      if (!correo.trim()) {
        setMensaje('Escribe el correo de tu cuenta.');
        return;
      }
      setOcupado(true);
      setMensaje('');
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(correo.trim(), { redirectTo: redirectUri });
        if (error) throw error;
        setMensaje('Te enviamos un enlace para restablecer tu contraseña. Abre el correo en este teléfono.');
      } catch (fallo) {
        setMensaje(traducirError(fallo));
      } finally {
        setOcupado(false);
      }
      return;
    }
    if (modo === 'actualizar') {
      if (contrasena.length < 8) {
        setMensaje('La nueva contraseña debe tener al menos 8 caracteres.');
        return;
      }
      setOcupado(true);
      setMensaje('');
      try {
        const { error } = await supabase.auth.updateUser({ password: contrasena });
        if (error) throw error;
        setModo('entrar');
        setContrasena('');
        setMensaje('Tu contraseña quedó actualizada.');
      } catch (fallo) {
        setMensaje(traducirError(fallo));
      } finally {
        setOcupado(false);
      }
      return;
    }
    if (modo === 'crear' && apodo.trim().length < 3) {
      setMensaje('Tu nombre o apodo debe tener al menos 3 caracteres.');
      return;
    }
    if (modo === 'crear' && estadoApodo === 'ocupado') {
      setMensaje('Ese nombre o apodo ya está en uso. Elige otro.');
      return;
    }
    if (modo === 'crear' && estadoApodo === 'comprobando') {
      setMensaje('Espera a que revisemos si tu nombre o apodo está disponible.');
      return;
    }
    if (!correo.trim() || contrasena.length < 8) {
      setMensaje('Escribe tu correo y una contraseña de al menos 8 caracteres.');
      return;
    }
    setOcupado(true);
    setMensaje('');
    try {
      const resultado = modo === 'entrar'
        ? await supabase.auth.signInWithPassword({ email: correo.trim(), password: contrasena })
        : await supabase.auth.signUp({
            email: correo.trim(),
            password: contrasena,
            options: { data: { usuario: apodo.trim() }, emailRedirectTo: redirectUri },
          });
      if (resultado.error) throw resultado.error;
      if (modo === 'crear' && !resultado.data.session) {
        setMensaje('Revisa tu correo para confirmar la cuenta y luego vuelve a entrar.');
      }
    } catch (error) {
      setMensaje(traducirError(error));
    } finally {
      setOcupado(false);
    }
  };

  const entrarConGoogle = async () => {
    if (!supabase) {
      setMensaje('Falta conectar las variables públicas de Supabase para probar el acceso.');
      return;
    }
    setOcupado(true);
    setMensaje('');
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUri, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data.url) throw new Error('Google no devolvió el enlace de acceso.');
      const resultado = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      if (resultado.type === 'success') await procesarEnlaceAuth(resultado.url);
    } catch (fallo) {
      setMensaje(traducirError(fallo));
    } finally {
      setOcupado(false);
    }
  };

  if (sesion && modo !== 'actualizar') return <InicioNativo sesion={sesion} alSalir={() => supabase?.auth.signOut()} />;

  return (
    <SafeAreaView style={estilos.pantalla} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={estilos.contenedorTeclado} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <View style={estilos.resplandor} />
        <View style={estilos.encabezado}>
          <View style={estilos.marca}><Image source={require('../assets-app-icon.png')} style={estilos.logoIcono} /></View>
          <Text style={estilos.logoTexto}>LukApp</Text>
          <Text style={estilos.subtitulo}>Tu plata tiene historia.{ '\n' }Aquí la entiendes.</Text>
          <View style={estilos.sello}><Sparkles color="#D9C6F3" size={14} /><Text style={estilos.selloTexto}>TU VIDA FINANCIERA, MÁS CLARA</Text></View>
        </View>

        <View style={estilos.tarjeta}>
          {modo === 'entrar' || modo === 'crear' ? <View style={estilos.segmento}>
            {(['entrar', 'crear'] as const).map((opcion) => (
              <Pressable key={opcion} onPress={() => { setModo(opcion); setMensaje(''); }} style={[estilos.opcion, modo === opcion && estilos.opcionActiva]} accessibilityRole="tab" accessibilityState={{ selected: modo === opcion }}>
                <Text style={[estilos.opcionTexto, modo === opcion && estilos.opcionTextoActiva]}>{opcion === 'entrar' ? 'Entrar' : 'Crear cuenta'}</Text>
              </Pressable>
            ))}
          </View> : <View style={estilos.tituloFlujo}><Text style={estilos.tituloFlujoTexto}>{modo === 'recuperar' ? 'Restablecer contraseña' : 'Crear contraseña nueva'}</Text><Pressable onPress={() => { setModo('entrar'); setMensaje(''); }}><Text style={estilos.recuperar}>Volver</Text></Pressable></View>}
          <Text style={estilos.intro}>{modo === 'entrar' ? 'Vuelve a ver tu dinero con claridad.' : modo === 'crear' ? 'Empieza a entender mejor tu dinero.' : modo === 'recuperar' ? 'Te enviaremos un enlace seguro a tu correo.' : 'Elige una contraseña nueva para tu cuenta.'}</Text>

          {modo === 'crear' ? <>
            <View style={estilos.etiquetaFila}><Text style={estilos.etiqueta}>TU NOMBRE O APODO</Text><Text style={[estilos.estadoApodo, estadoApodo === 'libre' && estilos.apodoDisponible, estadoApodo === 'ocupado' && estilos.apodoOcupado]}>{textoEstadoApodo(estadoApodo)}</Text></View>
            <View style={estilos.campo}>
              <Text style={estilos.iconoCampo}>@</Text>
              <TextInput value={apodo} onChangeText={(valor) => { setApodo(valor); setMensaje(''); }} placeholder="Ej. Julián" placeholderTextColor="#817B84" autoCapitalize="words" autoComplete="nickname" returnKeyType="next" style={estilos.entrada} accessibilityLabel="Tu nombre o apodo" />
            </View>
          </> : null}

          {modo !== 'actualizar' ? <><Text style={estilos.etiqueta}>TU CORREO</Text>
          <View style={estilos.campo}>
            <Mail color="#B6AFBA" size={19} />
            <TextInput value={correo} onChangeText={setCorreo} placeholder="tu@correo.com" placeholderTextColor="#817B84" autoCapitalize="none" autoComplete="email" keyboardType="email-address" returnKeyType="next" style={estilos.entrada} accessibilityLabel="Tu correo" />
          </View></> : null}

          {modo !== 'recuperar' ? <View style={estilos.etiquetaFila}><Text style={estilos.etiqueta}>{modo === 'actualizar' ? 'NUEVA CONTRASEÑA' : 'CONTRASEÑA'}</Text>{modo === 'entrar' && <Pressable onPress={() => { setModo('recuperar'); setMensaje(''); }}><Text style={estilos.recuperar}>¿Olvidaste tu contraseña?</Text></Pressable>}</View> : null}
          {modo !== 'recuperar' ? <>
          <View style={estilos.campo}>
            <LockKeyhole color="#B6AFBA" size={19} />
            <TextInput value={contrasena} onChangeText={setContrasena} placeholder="Mínimo 8 caracteres" placeholderTextColor="#817B84" secureTextEntry={!verContrasena} autoCapitalize="none" returnKeyType="done" onSubmitEditing={autenticar} style={estilos.entrada} accessibilityLabel={modo === 'actualizar' ? 'Nueva contraseña' : 'Contraseña'} />
            <Pressable onPress={() => setVerContrasena(!verContrasena)} hitSlop={12} accessibilityRole="button" accessibilityLabel={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{verContrasena ? <EyeOff color="#B6AFBA" size={19} /> : <Eye color="#B6AFBA" size={19} />}</Pressable>
          </View>
          </> : null}

          {mensaje ? <Text style={estilos.mensaje} accessibilityRole="alert">{mensaje}</Text> : null}
          <Pressable onPress={autenticar} disabled={ocupado} style={({ pressed }) => [estilos.boton, pressed && estilos.botonPresionado, ocupado && estilos.botonOcupado]} accessibilityRole="button">
            {ocupado ? <ActivityIndicator color="#21150A" /> : <><Text style={estilos.textoBoton}>{modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Crear mi cuenta' : modo === 'recuperar' ? 'Enviar enlace' : 'Guardar contraseña'}</Text><ArrowRight color="#21150A" size={20} /></>}
          </Pressable>
          {modo === 'entrar' ? <Pressable onPress={entrarConGoogle} disabled={ocupado} style={estilos.botonGoogle} accessibilityRole="button"><Text style={estilos.googleG}>G</Text><Text style={estilos.textoGoogle}>Continuar con Google</Text></Pressable> : null}
          <Text style={estilos.privacidad}>Tus datos financieros siempre son privados y tuyos.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type SeccionNativa = 'inicio' | 'movimientos' | 'dinero' | 'nuevo' | 'ajustes';
type PropiedadesInicio = { sesion: Session; alSalir: () => void };

function InicioNativo({ sesion, alSalir }: PropiedadesInicio) {
  const [datos, setDatos] = useState<Instantanea | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seccion, setSeccion] = useState<SeccionNativa>('inicio');
  const [tipo, setTipo] = useState<TxKind>('gasto');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('otros');
  const [cuentaId, setCuentaId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [bloqueoBiometrico, setBloqueoBiometrico] = useState(false);
  const [pantallaBloqueada, setPantallaBloqueada] = useState(false);
  const [cargandoSeguridad, setCargandoSeguridad] = useState(true);
  const [mensajeBloqueo, setMensajeBloqueo] = useState('');
  const [ocupadoBiometria, setOcupadoBiometria] = useState(false);
  const huboPausa = useRef(false);
  const cliente = supabase as SupabaseClient | null;
  const repositorio = cliente ? new RepositorioSupabase(cliente, sesion.user.id) : null;

  const recargar = async () => {
    if (!repositorio) {
      setError('No se pudo conectar con la cuenta de LukApp.');
      setCargando(false);
      return;
    }
    setCargando(true);
    setError('');
    try {
      setDatos(await repositorio.cargarTodo());
    } catch (fallo) {
      setError(traducirError(fallo));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { void recargar(); }, [sesion.user.id]);

  useEffect(() => {
    let vigente = true;
    SecureStore.getItemAsync('lukapp.bloqueo-biometrico')
      .then((valor) => {
        if (!vigente) return;
        const activo = valor === 'true';
        setBloqueoBiometrico(activo);
        setPantallaBloqueada(activo);
      })
      .catch(() => setMensajeBloqueo('No se pudo leer la configuración de seguridad del teléfono.'))
      .finally(() => { if (vigente) setCargandoSeguridad(false); });
    return () => { vigente = false; };
  }, []);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (estado) => {
      if (estado === 'background' || estado === 'inactive') {
        huboPausa.current = true;
      } else if (estado === 'active' && huboPausa.current) {
        huboPausa.current = false;
        if (bloqueoBiometrico) {
          setPantallaBloqueada(true);
          setMensajeBloqueo('');
        }
      }
    });
    return () => listener.remove();
  }, [bloqueoBiometrico]);

  const desbloquearConBiometria = async () => {
    setOcupadoBiometria(true);
    setMensajeBloqueo('');
    try {
      const resultado = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloquea LukApp',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });
      if (resultado.success) setPantallaBloqueada(false);
      else if (resultado.error !== 'user_cancel') setMensajeBloqueo('No pudimos verificar tu identidad. Inténtalo de nuevo.');
    } catch {
      setMensajeBloqueo('El bloqueo del teléfono no está disponible en este momento.');
    } finally {
      setOcupadoBiometria(false);
    }
  };

  const cambiarBloqueoBiometrico = async (activar: boolean) => {
    if (!activar) {
      try {
        await SecureStore.deleteItemAsync('lukapp.bloqueo-biometrico');
        setBloqueoBiometrico(false);
      } catch {
        Alert.alert('No se pudo cambiar', 'No pudimos actualizar el bloqueo de LukApp. Inténtalo de nuevo.');
      }
      return;
    }
    try {
      const tieneSensor = await LocalAuthentication.hasHardwareAsync();
      const tieneBiometria = await LocalAuthentication.isEnrolledAsync();
      if (!tieneSensor || !tieneBiometria) {
        Alert.alert('Configura el desbloqueo del teléfono', 'Primero registra tu huella, rostro o PIN de pantalla en los ajustes de Android.');
        return;
      }
      const resultado = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirma para activar el bloqueo de LukApp',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });
      if (!resultado.success) return;
      await SecureStore.setItemAsync('lukapp.bloqueo-biometrico', 'true');
      setBloqueoBiometrico(true);
    } catch {
      Alert.alert('No se pudo activar', 'Revisa el bloqueo de pantalla de tu teléfono e inténtalo de nuevo.');
    }
  };

  const guardarMovimiento = async () => {
    const amountCop = parseAmountInput(monto);
    if (!amountCop) {
      setError('Escribe un monto mayor que cero.');
      return;
    }
    if (!descripcion.trim()) {
      setError('Cuéntanos en qué fue el movimiento.');
      return;
    }
    if (!repositorio) return;
    const movimiento: Transaction = {
      id: nuevoId(),
      kind: tipo,
      amountCop,
      category: categoria,
      description: descripcion.trim(),
      occurredOn: bogotaDate(),
      cuentaId: cuentaId || null,
      rawTranscript: descripcion.trim(),
      createdAt: new Date().toISOString(),
    };
    setGuardando(true);
    setError('');
    try {
      await repositorio.guardarTransacciones([movimiento]);
      setMonto('');
      setDescripcion('');
      setCategoria('otros');
      await recargar();
      setSeccion('inicio');
    } catch (fallo) {
      setError(traducirError(fallo));
    } finally {
      setGuardando(false);
    }
  };

  const hoy = bogotaDate();
  const mes = monthKey(hoy);
  const movimientosMes = datos ? forMonth(datos.transacciones, mes) : [];
  const resumenMes = monthTotals(movimientosMes);
  const balance = datos ? patrimonio(datos.cajitas, datos.cajitaMovimientos, datos.transacciones) : null;
  const resumenCajitas = datos ? resumenDeCajitas(datos.cajitas, datos.cajitaMovimientos, datos.transacciones) : [];
  const cuentas = datos?.cajitas.filter((cuenta) => cuenta.tipo === 'cuenta' && cuenta.archivedAt === null) ?? [];
  const movimientosRecientes = datos?.transacciones.slice().sort((a, b) =>
    b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt),
  ).slice(0, seccion === 'movimientos' ? 100 : 6) ?? [];
  const nombre = typeof sesion.user.user_metadata?.usuario === 'string'
    ? sesion.user.user_metadata.usuario
    : sesion.user.email?.split('@')[0] ?? 'Tu espacio';

  if (cargandoSeguridad) return <SafeAreaView style={estilos.pantallaBloqueo} edges={['top', 'bottom']}><ActivityIndicator color={colores.oro} /></SafeAreaView>;
  if (pantallaBloqueada) return (
    <SafeAreaView style={estilos.pantallaBloqueo} edges={['top', 'bottom']}>
      <View style={estilos.bloqueoMarca}><Image source={require('../assets-app-icon.png')} style={estilos.logoBloqueo} /></View>
      <Text style={estilos.logoTexto}>LukApp</Text>
      <View style={estilos.candado}><LockKeyhole color="#E5D4F6" size={26} /></View>
      <Text style={estilos.bloqueoTitulo}>Tus finanzas están protegidas</Text>
      <Text style={estilos.bloqueoTexto}>Confirma tu identidad para volver a tus datos.</Text>
      {mensajeBloqueo ? <Text style={estilos.mensajeBloqueo}>{mensajeBloqueo}</Text> : null}
      <Pressable onPress={desbloquearConBiometria} disabled={ocupadoBiometria} style={estilos.botonDesbloqueo} accessibilityRole="button">
        {ocupadoBiometria ? <ActivityIndicator color="#21150A" /> : <Text style={estilos.textoBoton}>Desbloquear con el teléfono</Text>}
      </Pressable>
      <Pressable onPress={alSalir} style={estilos.salirBloqueo} accessibilityRole="button"><Text style={estilos.textoSalir}>Cerrar sesión</Text></Pressable>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={estilos.pantallaFinanciera} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={estilos.cabeceraFinanciera}>
        <View style={estilos.marcaCompacta}><Image source={require('../assets-app-icon.png')} style={estilos.logoCompacto} /></View>
        <View style={estilos.saludoContenedor}>
          <Text style={estilos.saludoPequeno}>{seccion === 'ajustes' ? 'TU CUENTA' : seccion === 'dinero' ? 'TU PATRIMONIO' : monthKeyLabel(mes).toUpperCase()}</Text>
          <Text style={estilos.saludoNombre}>{seccion === 'ajustes' ? 'Ajustes' : seccion === 'dinero' ? 'Tu dinero' : `Hola, ${nombre}`}</Text>
        </View>
        <Pressable onPress={() => setSeccion('ajustes')} style={estilos.avatarBoton} accessibilityRole="button" accessibilityLabel="Abrir ajustes">
          <Settings color="#EDE8F0" size={19} />
        </Pressable>
      </View>

      {error ? <Pressable onPress={() => setError('')} style={estilos.avisoError} accessibilityRole="alert"><Text style={estilos.avisoErrorTexto}>{error}</Text></Pressable> : null}

      <ScrollView
        style={estilos.contenidoFinanciero}
        contentContainerStyle={estilos.contenidoFinancieroInterior}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={cargando && datos !== null} onRefresh={recargar} tintColor={colores.oro} colors={[colores.oro]} />}
      >
        {seccion === 'inicio' ? <>
          <View style={estilos.tarjetaSaldo}>
            <View style={estilos.luzTarjeta} />
            <View style={estilos.tarjetaSaldoFila}><Wallet color="#D9C5F6" size={18} /><Text style={estilos.tarjetaSaldoEtiqueta}>PATRIMONIO</Text><View style={estilos.chipSeguro}><View style={estilos.puntoEnLinea} /><Text style={estilos.chipSeguroTexto}>PRIVADO</Text></View></View>
            {cargando && !datos ? <ActivityIndicator color={colores.texto} style={estilos.cargandoSaldo} /> : <Text style={estilos.valorSaldo}>{formatCop(balance?.netoCop ?? 0)}</Text>}
            <Text style={estilos.detalleSaldo}>Lo que tienes menos lo que debes</Text>
            <View style={estilos.separadorSaldo} />
            <View style={estilos.resumenDoble}>
              <View style={estilos.resumenColumna}><Text style={estilos.resumenEtiqueta}>INGRESOS</Text><Text style={[estilos.resumenValor, estilos.verde]}>+{formatCop(resumenMes.ingresos)}</Text></View>
              <View style={estilos.divisorVertical} />
              <View style={estilos.resumenColumna}><Text style={estilos.resumenEtiqueta}>GASTOS</Text><Text style={[estilos.resumenValor, estilos.rojo]}>−{formatCop(resumenMes.gastos)}</Text></View>
            </View>
          </View>

          <View style={estilos.atajosFila}>
            <Pressable onPress={() => { setTipo('gasto'); setSeccion('nuevo'); }} style={estilos.atajo} accessibilityRole="button"><View style={[estilos.atajoIcono, { backgroundColor: '#352228' }]}><ArrowDownLeft color="#FF8D98" size={20} /></View><Text style={estilos.atajoTexto}>Gasto</Text></Pressable>
            <Pressable onPress={() => { setTipo('ingreso'); setSeccion('nuevo'); }} style={estilos.atajo} accessibilityRole="button"><View style={[estilos.atajoIcono, { backgroundColor: '#1E342B' }]}><ArrowUpRight color="#7EE0AE" size={20} /></View><Text style={estilos.atajoTexto}>Ingreso</Text></Pressable>
            <Pressable onPress={() => setSeccion('movimientos')} style={estilos.atajo} accessibilityRole="button"><View style={[estilos.atajoIcono, { backgroundColor: '#282333' }]}><List color="#D8C8EF" size={20} /></View><Text style={estilos.atajoTexto}>Historial</Text></Pressable>
          </View>

          <View style={estilos.seccionTituloFila}><View><Text style={estilos.seccionTitulo}>Movimientos recientes</Text><Text style={estilos.seccionSubtitulo}>Lo último que pasó con tu plata</Text></View><Pressable onPress={() => setSeccion('movimientos')} accessibilityRole="button"><Text style={estilos.verTodo}>Ver todos</Text></Pressable></View>
          <ListaMovimientos movimientos={movimientosRecientes} categorias={datos?.categorias ?? []} cargando={cargando} />
          {datos && datos.transacciones.length === 0 ? <VistaVacia onAgregar={() => setSeccion('nuevo')} /> : null}
        </> : null}

        {seccion === 'movimientos' ? <>
          <View style={estilos.seccionTituloFila}><View><Text style={estilos.seccionTitulo}>Tu actividad</Text><Text style={estilos.seccionSubtitulo}>{movimientosMes.length} movimientos en {monthKeyLabel(mes)}</Text></View></View>
          <ListaMovimientos movimientos={movimientosRecientes} categorias={datos?.categorias ?? []} cargando={cargando} />
          {datos && datos.transacciones.length === 0 ? <VistaVacia onAgregar={() => setSeccion('nuevo')} /> : null}
        </> : null}

        {seccion === 'dinero' ? <>
          <View style={estilos.tarjetaPatrimonio}><Text style={estilos.resumenEtiqueta}>PATRIMONIO NETO</Text><Text style={estilos.valorPatrimonio}>{formatCop(balance?.netoCop ?? 0)}</Text><View style={estilos.filaTotalesPatrimonio}><View><Text style={estilos.resumenEtiqueta}>TIENES</Text><Text style={[estilos.montoGrupoPatrimonio, estilos.verde]}>{formatCop(balance?.totalCop ?? 0)}</Text></View><View><Text style={estilos.resumenEtiqueta}>DEBES</Text><Text style={[estilos.montoGrupoPatrimonio, estilos.rojo]}>{formatCop(balance?.deudasCop ?? 0)}</Text></View></View></View>
          {(['cuenta', 'cajita', 'deuda', 'tarjeta'] as CajitaTipo[]).map((tipoCuenta) => {
            const filas = resumenCajitas.filter(({ cajita }) => cajita.tipo === tipoCuenta);
            const total = filas.reduce((suma, fila) => suma + fila.saldoCop, 0);
            const sustantivo = tipoCuenta === 'cuenta' ? 'cuentas' : tipoCuenta === 'cajita' ? 'ahorros' : tipoCuenta === 'deuda' ? 'deudas' : 'tarjetas';
            return <View key={tipoCuenta} style={estilos.grupoDinero}><View style={estilos.encabezadoGrupoDinero}><View><Text style={estilos.tituloGrupoDinero}>{ETIQUETAS_GRUPO_DINERO[tipoCuenta]}</Text><Text style={estilos.subtituloGrupoDinero}>{filas.length} {filas.length === 1 ? 'espacio' : 'espacios'}</Text></View><Text style={[estilos.totalGrupoDinero, ES_PASIVO[tipoCuenta] ? estilos.rojo : estilos.textoTotalDinero]}>{formatCop(ES_PASIVO[tipoCuenta] ? Math.abs(total) : total)}</Text></View>{filas.length ? filas.map(({ cajita, saldoCop }) => <View key={cajita.id} style={estilos.filaDinero}><View style={estilos.iconoDinero}><Text style={estilos.emojiDinero}>{cajita.icon || '💰'}</Text></View><View style={estilos.detalleMovimiento}><Text style={estilos.descripcionMovimiento}>{cajita.nombre}</Text><Text style={estilos.metadatosMovimiento}>{TIPO_LABELS[cajita.tipo]}</Text></View><Text style={[estilos.montoMovimiento, ES_PASIVO[tipoCuenta] ? estilos.rojo : estilos.textoTotalDinero]}>{formatCop(ES_PASIVO[tipoCuenta] ? Math.abs(saldoCop) : saldoCop)}</Text></View>) : <Text style={estilos.sinCuentas}>{cargando ? 'Cargando tus datos…' : `Todavía no tienes ${sustantivo}.`}</Text>}</View>;
          })}
        </> : null}

        {seccion === 'nuevo' ? <>
          <View style={estilos.seccionTituloFila}><View><Text style={estilos.seccionTitulo}>Nuevo movimiento</Text><Text style={estilos.seccionSubtitulo}>Quedará guardado en tu cuenta de LukApp</Text></View></View>
          <View style={estilos.formulario}>
            <View style={estilos.segmentoFinanciero}>
              {(['gasto', 'ingreso'] as const).map((opcion) => <Pressable key={opcion} onPress={() => setTipo(opcion)} style={[estilos.segmentoOpcion, tipo === opcion && (opcion === 'gasto' ? estilos.segmentoGasto : estilos.segmentoIngreso)]} accessibilityRole="tab" accessibilityState={{ selected: tipo === opcion }}><Text style={[estilos.segmentoTexto, tipo === opcion && estilos.segmentoTextoActivo]}>{opcion === 'gasto' ? 'Gasto' : 'Ingreso'}</Text></Pressable>)}
            </View>
            <Text style={estilos.etiquetaFormulario}>MONTO</Text>
            <View style={estilos.campoMonto}><Text style={estilos.prefijoPesos}>$</Text><TextInput value={monto} onChangeText={(valor) => { setMonto(formatAmountInput(Number(valor.replace(/\D/g, '')) || null)); setError(''); }} placeholder="0" placeholderTextColor="#68636C" keyboardType="number-pad" style={estilos.entradaMonto} accessibilityLabel="Monto en pesos colombianos" /></View>
            <Text style={estilos.etiquetaFormulario}>¿EN QUÉ FUE?</Text>
            <TextInput value={descripcion} onChangeText={(valor) => { setDescripcion(valor); setError(''); }} placeholder={tipo === 'gasto' ? 'Ej. Almuerzo con amigos' : 'Ej. Pago de nómina'} placeholderTextColor="#77717B" style={estilos.entradaDescripcion} returnKeyType="done" accessibilityLabel="Descripción del movimiento" />
            <Text style={estilos.etiquetaFormulario}>CATEGORÍA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chipsFila}>
              {Object.entries(CATEGORY_LABELS).filter(([id]) => id !== 'transferencia').map(([id, label]) => <Pressable key={id} onPress={() => setCategoria(id)} style={[estilos.chipCategoria, categoria === id && estilos.chipCategoriaActiva]} accessibilityRole="button" accessibilityState={{ selected: categoria === id }}><Text style={[estilos.chipCategoriaTexto, categoria === id && estilos.chipCategoriaTextoActiva]}>{label}</Text></Pressable>)}
            </ScrollView>
            <Text style={estilos.etiquetaFormulario}>CUENTA (OPCIONAL)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chipsFila}>
              <Pressable onPress={() => setCuentaId('')} style={[estilos.chipCategoria, !cuentaId && estilos.chipCategoriaActiva]} accessibilityRole="button"><Text style={[estilos.chipCategoriaTexto, !cuentaId && estilos.chipCategoriaTextoActiva]}>Sin cuenta</Text></Pressable>
              {cuentas.map((cuenta) => <Pressable key={cuenta.id} onPress={() => setCuentaId(cuenta.id)} style={[estilos.chipCategoria, cuentaId === cuenta.id && estilos.chipCategoriaActiva]} accessibilityRole="button"><Text style={[estilos.chipCategoriaTexto, cuentaId === cuenta.id && estilos.chipCategoriaTextoActiva]}>{cuenta.nombre}</Text></Pressable>)}
            </ScrollView>
            <Pressable onPress={guardarMovimiento} disabled={guardando} style={({ pressed }) => [estilos.botonGuardar, pressed && estilos.botonPresionado, guardando && estilos.botonOcupado]} accessibilityRole="button">
              {guardando ? <ActivityIndicator color="#21150A" /> : <><Text style={estilos.textoBoton}>Guardar movimiento</Text><ArrowRight color="#21150A" size={19} /></>}
            </Pressable>
          </View>
        </> : null}

        {seccion === 'ajustes' ? <>
          <View style={estilos.seccionTituloFila}><View><Text style={estilos.seccionTitulo}>Tu cuenta</Text><Text style={estilos.seccionSubtitulo}>Tus datos siguen protegidos</Text></View></View>
          <View style={estilos.tarjetaAjustes}><View style={estilos.avatarUsuario}><Text style={estilos.avatarInicial}>{nombre.slice(0, 1).toUpperCase()}</Text></View><View style={estilos.datosUsuario}><Text style={estilos.nombreUsuario}>{nombre}</Text><Text style={estilos.correoUsuario}>{sesion.user.email}</Text></View></View>
          <View style={estilos.filaAjuste}>
            <View style={estilos.dispositivoBloqueo}><Text style={estilos.filaAjusteTitulo}>Bloqueo con huella o PIN</Text><Text style={estilos.filaAjusteDetalle}>Pide verificarte al volver a LukApp</Text></View>
            <Switch value={bloqueoBiometrico} onValueChange={(valor) => void cambiarBloqueoBiometrico(valor)} trackColor={{ false: '#45414A', true: '#87633A' }} thumbColor={bloqueoBiometrico ? '#F3C467' : '#CCC5D0'} accessibilityLabel="Bloqueo con huella o PIN" />
          </View>
          <Pressable onPress={() => Alert.alert('LukApp', `Versión ${VERSION}`)} style={estilos.filaAjuste}><View><Text style={estilos.filaAjusteTitulo}>Versión de LukApp</Text><Text style={estilos.filaAjusteDetalle}>Aplicación nativa Android</Text></View><Text style={estilos.versionTexto}>{VERSION_MOVIL}</Text></Pressable>
          <Pressable onPress={alSalir} style={estilos.botonSalir} accessibilityRole="button"><Text style={estilos.textoSalir}>Cerrar sesión</Text></Pressable>
        </> : null}
      </ScrollView>

      <View style={estilos.barraNavegacion}>
        <BotonNav icono={<Home size={20} />} etiqueta="Inicio" activo={seccion === 'inicio'} alTocar={() => setSeccion('inicio')} />
        <BotonNav icono={<List size={20} />} etiqueta="Movimientos" activo={seccion === 'movimientos'} alTocar={() => setSeccion('movimientos')} />
        <Pressable onPress={() => { setError(''); setSeccion('nuevo'); }} style={estilos.botonMas} accessibilityRole="button" accessibilityLabel="Agregar movimiento"><Plus color="#21150A" size={25} strokeWidth={2.6} /></Pressable>
        <BotonNav icono={<Wallet size={20} />} etiqueta="Dinero" activo={seccion === 'dinero'} alTocar={() => setSeccion('dinero')} />
        <BotonNav icono={<Settings size={20} />} etiqueta="Ajustes" activo={seccion === 'ajustes'} alTocar={() => setSeccion('ajustes')} />
      </View>
    </SafeAreaView>
  );
}

function BotonNav({ icono, etiqueta, activo, alTocar }: { icono: ReactNode; etiqueta: string; activo: boolean; alTocar: () => void }) {
  return <Pressable onPress={alTocar} style={estilos.itemNav} accessibilityRole="tab" accessibilityState={{ selected: activo }}><View style={[estilos.iconoNav, activo && estilos.iconoNavActivo]}>{icono}</View><Text style={[estilos.textoNav, activo && estilos.textoNavActivo]}>{etiqueta}</Text></Pressable>;
}

function ListaMovimientos({ movimientos, categorias, cargando }: { movimientos: Transaction[]; categorias: Instantanea['categorias']; cargando: boolean }) {
  if (cargando && movimientos.length === 0) return <View style={estilos.cargandoLista}><ActivityIndicator color={colores.oro} /><Text style={estilos.textoCargando}>Cargando tus movimientos…</Text></View>;
  return <View style={estilos.listaMovimientos}>{movimientos.map((movimiento) => {
    const categoriaPersonal = categorias.find((item) => item.id === movimiento.category);
    const categoriaNombre = categoriaPersonal?.nombre ?? CATEGORY_LABELS[movimiento.category as keyof typeof CATEGORY_LABELS] ?? 'Movimiento';
    const icono = movimiento.kind === 'ingreso' ? <ArrowUpRight color="#73DCA5" size={19} /> : movimiento.kind === 'gasto' ? <ArrowDownLeft color="#FF8994" size={19} /> : <ArrowLeftRight color="#C7B2E5" size={19} />;
    const colorMonto = movimiento.kind === 'ingreso' ? estilos.verde : movimiento.kind === 'gasto' ? estilos.rojo : estilos.neutro;
    return <View key={movimiento.id} style={estilos.filaMovimiento}><View style={[estilos.iconoMovimiento, movimiento.kind === 'ingreso' ? estilos.iconoIngreso : movimiento.kind === 'gasto' ? estilos.iconoGasto : estilos.iconoTransferencia]}>{icono}</View><View style={estilos.detalleMovimiento}><Text numberOfLines={1} style={estilos.descripcionMovimiento}>{movimiento.description || categoriaNombre}</Text><Text style={estilos.metadatosMovimiento}>{categoriaNombre} · {movimiento.occurredOn}</Text></View><Text style={[estilos.montoMovimiento, colorMonto]}>{movimiento.kind === 'ingreso' ? '+' : movimiento.kind === 'gasto' ? '−' : ''}{formatCop(movimiento.amountCop)}</Text></View>;
  })}</View>;
}

function VistaVacia({ onAgregar }: { onAgregar: () => void }) {
  return <View style={estilos.vacio}><View style={estilos.vacioIcono}><Wallet color="#D7C5EF" size={22} /></View><Text style={estilos.vacioTitulo}>Aquí comienza tu historia</Text><Text style={estilos.vacioTexto}>Registra tu primer movimiento para empezar a entender cómo se mueve tu plata.</Text><Pressable onPress={onAgregar} style={estilos.vacioBoton} accessibilityRole="button"><Text style={estilos.vacioBotonTexto}>Registrar movimiento</Text></Pressable></View>;
}

const VERSION_MOVIL = VERSION;

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenedorTeclado: { flex: 1 },
  contenido: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 36, paddingBottom: 28, overflow: 'hidden' },
  resplandor: { position: 'absolute', width: 300, height: 300, borderRadius: 180, backgroundColor: '#6426A4', opacity: 0.12, top: -155, alignSelf: 'center' },
  encabezado: { alignItems: 'center', paddingTop: 10, paddingBottom: 27 },
  marca: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#211B2A', borderColor: '#40324F', borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  logoIcono: { width: 35, height: 35, borderRadius: 12 } as ImageStyle,
  logoTexto: { color: colores.texto, fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  subtitulo: { marginTop: 8, color: '#C0B9C5', fontSize: 16, textAlign: 'center', lineHeight: 23 },
  sello: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#261F30' },
  selloTexto: { color: '#D9C6F3', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  tarjeta: { backgroundColor: colores.panel, borderRadius: 29, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, borderColor: '#302D32', borderWidth: 1 },
  segmento: { height: 58, padding: 5, backgroundColor: '#252326', borderRadius: 19, flexDirection: 'row', marginBottom: 21 },
  tituloFlujo: { minHeight: 58, paddingHorizontal: 17, borderRadius: 19, backgroundColor: '#252326', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 21 },
  tituloFlujoTexto: { color: '#F5F0F8', fontSize: 14, fontWeight: '700' },
  opcion: { flex: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  opcionActiva: { backgroundColor: '#322B25' },
  opcionTexto: { color: '#AAA5AC', fontSize: 14, fontWeight: '600' },
  opcionTextoActiva: { color: '#FFF8EF', fontWeight: '700' },
  intro: { color: '#C6C0C8', fontSize: 14, lineHeight: 21, marginBottom: 25 },
  etiqueta: { color: '#C6C0C8', fontSize: 11, letterSpacing: 1.1, fontWeight: '700' },
  campo: { height: 61, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, backgroundColor: colores.campo, borderRadius: 19, borderWidth: 1, borderColor: colores.borde, marginTop: 11, marginBottom: 24 },
  entrada: { flex: 1, color: colores.texto, fontSize: 16, paddingVertical: 0 },
  etiquetaFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recuperar: { color: '#F2C659', fontSize: 12, fontWeight: '600' },
  mensaje: { marginTop: 2, marginBottom: 14, color: '#F1C96A', fontSize: 13, lineHeight: 19 },
  boton: { height: 60, marginTop: 8, borderRadius: 20, backgroundColor: colores.oro, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  botonGoogle: { height: 54, marginTop: 12, borderRadius: 18, backgroundColor: '#242226', borderWidth: 1, borderColor: '#403B43', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 11 },
  googleG: { color: '#E8D3FF', fontSize: 17, fontWeight: '800' },
  textoGoogle: { color: '#E8E3EA', fontSize: 14, fontWeight: '600' },
  botonPresionado: { transform: [{ scale: 0.985 }], backgroundColor: '#D99517' },
  botonOcupado: { opacity: 0.8 },
  textoBoton: { color: '#24180C', fontSize: 16, fontWeight: '800' },
  estadoApodo: { color: '#A9A3AD', fontSize: 11 },
  apodoDisponible: { color: '#72DBAA' },
  apodoOcupado: { color: '#FF9097' },
  iconoCampo: { color: '#B6AFBA', fontSize: 20, fontWeight: '700' },
  privacidad: { marginTop: 19, textAlign: 'center', color: '#8F8992', fontSize: 12 },
  pantallaInicio: { flex: 1, backgroundColor: colores.fondo, paddingHorizontal: 24, justifyContent: 'center', overflow: 'hidden' },
  orbeGrande: { position: 'absolute', width: 350, height: 350, borderRadius: 200, backgroundColor: colores.morado, opacity: 0.14, top: -180, right: -120 },
  cabeceraInicio: { alignItems: 'center', marginBottom: 36 },
  tarjetaInicio: { backgroundColor: colores.panel, padding: 23, borderRadius: 28, borderWidth: 1, borderColor: '#302D32' },
  tituloInicio: { color: colores.texto, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 13 },
  textoInicio: { color: colores.tenue, fontSize: 15, lineHeight: 23, marginTop: 10 },
  estadoCuenta: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 14, backgroundColor: colores.campo, borderRadius: 16, marginTop: 23 },
  puntoVerde: { width: 8, height: 8, borderRadius: 8, backgroundColor: '#51D69A' },
  correoCuenta: { color: '#DCD7DF', fontSize: 13, flexShrink: 1 },
  botonSecundario: { marginTop: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: colores.borde },
  textoSecundario: { color: colores.texto, fontSize: 14, fontWeight: '700' },
  pantallaFinanciera: { flex: 1, backgroundColor: colores.fondo },
  cabeceraFinanciera: { minHeight: 76, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  marcaCompacta: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#211B2A', borderColor: '#40324F', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logoCompacto: { width: 27, height: 27, borderRadius: 9 } as ImageStyle,
  saludoContenedor: { flex: 1 },
  saludoPequeno: { color: '#A9A0B1', fontSize: 10, fontWeight: '700', letterSpacing: 1.3 },
  saludoNombre: { color: colores.texto, fontSize: 18, fontWeight: '700', marginTop: 3 },
  avatarBoton: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#211F23', borderWidth: 1, borderColor: '#343039', alignItems: 'center', justifyContent: 'center' },
  contenidoFinanciero: { flex: 1 },
  contenidoFinancieroInterior: { paddingHorizontal: 22, paddingTop: 7, paddingBottom: 28 },
  tarjetaSaldo: { backgroundColor: '#211D28', borderRadius: 28, borderWidth: 1, borderColor: '#41344D', padding: 21, overflow: 'hidden' },
  tarjetaPatrimonio: { backgroundColor: '#211D28', borderRadius: 25, borderWidth: 1, borderColor: '#41344D', padding: 20, marginBottom: 15 },
  valorPatrimonio: { color: '#FFF9FF', fontSize: 30, fontWeight: '800', letterSpacing: -0.8, marginTop: 10 },
  filaTotalesPatrimonio: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#FFFFFF16', paddingTop: 15, marginTop: 17 },
  montoGrupoPatrimonio: { fontSize: 13, fontWeight: '700', marginTop: 7 },
  grupoDinero: { backgroundColor: '#19181B', borderRadius: 21, borderWidth: 1, borderColor: '#2E2B31', paddingHorizontal: 15, paddingTop: 15, paddingBottom: 4, marginBottom: 12 },
  encabezadoGrupoDinero: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  tituloGrupoDinero: { color: '#F0ECF2', fontSize: 14, fontWeight: '700' },
  subtituloGrupoDinero: { color: '#928C96', fontSize: 11, marginTop: 4 },
  totalGrupoDinero: { fontSize: 13, fontWeight: '700' },
  textoTotalDinero: { color: '#F0ECF2' },
  filaDinero: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderTopColor: '#FFFFFF0C' },
  iconoDinero: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#282333' },
  emojiDinero: { fontSize: 18 },
  sinCuentas: { color: '#928C96', fontSize: 12, lineHeight: 18, paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#FFFFFF0C' },
  luzTarjeta: { position: 'absolute', width: 200, height: 200, borderRadius: 120, top: -105, right: -70, backgroundColor: '#9A62D2', opacity: 0.12 },
  tarjetaSaldoFila: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tarjetaSaldoEtiqueta: { color: '#D0C3DD', fontSize: 11, letterSpacing: 1.3, fontWeight: '700', flex: 1 },
  chipSeguro: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, backgroundColor: '#30283A', paddingVertical: 6, paddingHorizontal: 9 },
  puntoEnLinea: { width: 6, height: 6, borderRadius: 6, backgroundColor: '#73DCA5' },
  chipSeguroTexto: { color: '#CEC2D7', fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  valorSaldo: { color: '#FFF9FF', fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 19 },
  cargandoSaldo: { marginTop: 20, alignSelf: 'flex-start' },
  detalleSaldo: { color: '#AAA1B1', fontSize: 12, marginTop: 6 },
  separadorSaldo: { height: 1, backgroundColor: '#FFFFFF16', marginVertical: 19 },
  resumenDoble: { flexDirection: 'row', alignItems: 'center' },
  resumenColumna: { flex: 1, gap: 7 },
  resumenEtiqueta: { color: '#AAA2AF', fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  resumenValor: { color: colores.texto, fontSize: 15, fontWeight: '700' },
  divisorVertical: { width: 1, height: 33, backgroundColor: '#FFFFFF1C', marginHorizontal: 15 },
  verde: { color: '#7DDEAC' },
  rojo: { color: '#FF939D' },
  neutro: { color: '#D3C6E3' },
  atajosFila: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 17, marginBottom: 27, gap: 12 },
  atajo: { flex: 1, minHeight: 83, borderRadius: 19, backgroundColor: '#1B1A1D', borderWidth: 1, borderColor: '#302D32', alignItems: 'center', justifyContent: 'center', gap: 8 },
  atajoIcono: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  atajoTexto: { color: '#DAD5DE', fontSize: 12, fontWeight: '600' },
  seccionTituloFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, marginTop: 2 },
  seccionTitulo: { color: colores.texto, fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  seccionSubtitulo: { color: '#948E99', fontSize: 12, marginTop: 5 },
  verTodo: { color: '#E6BD69', fontSize: 12, fontWeight: '700', paddingVertical: 9, paddingLeft: 12 },
  listaMovimientos: { borderRadius: 22, borderWidth: 1, borderColor: '#2E2B31', backgroundColor: '#19181B', paddingHorizontal: 14 },
  filaMovimiento: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#FFFFFF0C' },
  iconoMovimiento: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconoIngreso: { backgroundColor: '#1E342B' },
  iconoGasto: { backgroundColor: '#352228' },
  iconoTransferencia: { backgroundColor: '#282333' },
  detalleMovimiento: { flex: 1, gap: 5 },
  descripcionMovimiento: { color: '#F0ECF2', fontSize: 13, fontWeight: '600' },
  metadatosMovimiento: { color: '#928C96', fontSize: 11 },
  montoMovimiento: { fontSize: 13, fontWeight: '700' },
  vacio: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 15 },
  vacioIcono: { width: 54, height: 54, borderRadius: 19, backgroundColor: '#282333', alignItems: 'center', justifyContent: 'center' },
  vacioTitulo: { color: colores.texto, fontSize: 16, fontWeight: '700', marginTop: 15 },
  vacioTexto: { color: '#A49DA8', fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 8, maxWidth: 270 },
  vacioBoton: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 17, borderRadius: 15, backgroundColor: '#322B25' },
  vacioBotonTexto: { color: '#F1C362', fontSize: 13, fontWeight: '700' },
  cargandoLista: { minHeight: 110, justifyContent: 'center', alignItems: 'center', gap: 10 },
  textoCargando: { color: '#A49DA8', fontSize: 12 },
  formulario: { backgroundColor: '#1B1A1D', borderRadius: 25, borderWidth: 1, borderColor: '#302D32', padding: 17, paddingBottom: 20 },
  segmentoFinanciero: { height: 51, padding: 4, borderRadius: 16, flexDirection: 'row', backgroundColor: '#131214', marginBottom: 22 },
  segmentoOpcion: { flex: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  segmentoGasto: { backgroundColor: '#3A252B' },
  segmentoIngreso: { backgroundColor: '#20352B' },
  segmentoTexto: { color: '#9D97A0', fontSize: 13, fontWeight: '600' },
  segmentoTextoActivo: { color: '#F8F3F8', fontWeight: '700' },
  etiquetaFormulario: { color: '#B7B0BB', fontSize: 10, letterSpacing: 1.1, fontWeight: '700', marginTop: 17 },
  campoMonto: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#403B43' },
  prefijoPesos: { color: '#F2C15D', fontSize: 25, fontWeight: '600' },
  entradaMonto: { flex: 1, color: '#FFF8FF', fontSize: 34, fontWeight: '700', paddingVertical: 9 },
  entradaDescripcion: { minHeight: 52, borderRadius: 15, backgroundColor: '#131214', borderWidth: 1, borderColor: '#343039', color: colores.texto, paddingHorizontal: 14, fontSize: 14, marginTop: 9 },
  chipsFila: { gap: 8, paddingVertical: 10 },
  chipCategoria: { borderRadius: 15, borderWidth: 1, borderColor: '#39353D', paddingVertical: 10, paddingHorizontal: 13, backgroundColor: '#171619' },
  chipCategoriaActiva: { borderColor: '#87633A', backgroundColor: '#352B22' },
  chipCategoriaTexto: { color: '#ABA5AE', fontSize: 12, fontWeight: '600' },
  chipCategoriaTextoActiva: { color: '#F3CF86' },
  botonGuardar: { height: 56, borderRadius: 18, backgroundColor: colores.oro, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 11, marginTop: 22 },
  barraNavegacion: { minHeight: 68, paddingHorizontal: 11, paddingTop: 8, paddingBottom: 5, borderTopWidth: 1, borderTopColor: '#2C292F', backgroundColor: '#171619', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  itemNav: { minWidth: 66, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 3 },
  iconoNav: { height: 28, minWidth: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconoNavActivo: { backgroundColor: '#30263B' },
  textoNav: { color: '#928C96', fontSize: 9, fontWeight: '600' },
  textoNavActivo: { color: '#E4D0FB' },
  botonMas: { width: 52, height: 52, borderRadius: 18, backgroundColor: colores.oro, alignItems: 'center', justifyContent: 'center', marginTop: -26, borderWidth: 5, borderColor: colores.fondo },
  avisoError: { marginHorizontal: 22, marginBottom: 9, backgroundColor: '#392326', borderRadius: 15, borderWidth: 1, borderColor: '#644047', padding: 12 },
  avisoErrorTexto: { color: '#FFC1C7', fontSize: 12, lineHeight: 18 },
  tarjetaAjustes: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 21, backgroundColor: '#1B1A1D', borderWidth: 1, borderColor: '#302D32', padding: 16, marginBottom: 14 },
  avatarUsuario: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#352B42', alignItems: 'center', justifyContent: 'center' },
  avatarInicial: { color: '#E4D0FB', fontSize: 21, fontWeight: '800' },
  datosUsuario: { flex: 1, gap: 5 },
  nombreUsuario: { color: '#F5F0F8', fontSize: 14, fontWeight: '700' },
  correoUsuario: { color: '#A9A2AC', fontSize: 12 },
  filaAjuste: { minHeight: 66, paddingHorizontal: 15, borderRadius: 18, backgroundColor: '#1B1A1D', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#302D32' },
  filaAjusteTitulo: { color: '#EDE8F0', fontSize: 13, fontWeight: '600' },
  filaAjusteDetalle: { color: '#958E99', fontSize: 11, marginTop: 4 },
  versionTexto: { color: '#C9B6E0', fontSize: 12, fontWeight: '700' },
  botonSalir: { marginTop: 18, minHeight: 54, borderRadius: 17, borderColor: '#5A343A', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textoSalir: { color: '#FF9FA7', fontSize: 14, fontWeight: '700' },
  pantallaBloqueo: { flex: 1, backgroundColor: colores.fondo, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  bloqueoMarca: { width: 76, height: 76, borderRadius: 26, backgroundColor: '#211B2A', borderColor: '#40324F', borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  logoBloqueo: { width: 48, height: 48, borderRadius: 16 } as ImageStyle,
  candado: { width: 68, height: 68, borderRadius: 24, backgroundColor: '#2A2332', alignItems: 'center', justifyContent: 'center', marginTop: 39 },
  bloqueoTitulo: { color: '#F5F0F8', fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 19 },
  bloqueoTexto: { color: '#A8A0AB', fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 9, maxWidth: 270 },
  mensajeBloqueo: { color: '#FFC1C7', fontSize: 12, textAlign: 'center', marginTop: 15 },
  botonDesbloqueo: { minHeight: 56, alignSelf: 'stretch', borderRadius: 18, backgroundColor: colores.oro, alignItems: 'center', justifyContent: 'center', marginTop: 27 },
  salirBloqueo: { minHeight: 48, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  dispositivoBloqueo: { flex: 1, paddingRight: 10 },
});

function textoEstadoApodo(estado: EstadoApodo) {
  switch (estado) {
    case 'corto': return 'Mínimo 3 caracteres';
    case 'comprobando': return 'Revisando…';
    case 'libre': return 'Disponible';
    case 'ocupado': return 'Ya está en uso';
    case 'sin-verificar': return 'No pudimos comprobarlo';
    default: return '';
  }
}
