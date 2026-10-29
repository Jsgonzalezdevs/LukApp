# LukApp móvil

Cliente Android en React Native y Expo. Muestra `https://mi.lukapp.app/` dentro
de una WebView para conservar la misma interfaz, autenticación, navegación y
funciones que la PWA. Los enlaces internos siguen en la app y el botón Atrás de
Android recorre el historial web antes de cerrar la app. El identificador
Android se conserva como `lukApp.App`, según la aplicación de Play Console.

## Primera etapa

La interfaz completa de LukApp se entrega desde la web, incluidos Inicio,
Dinero, Mes, Asesor, Más, Premium y las herramientas administrativas. Los datos
siguen en Supabase con las políticas RLS que usa la web. La integración nativa
que estaba en `src/AppNativa.tsx` queda conservada como prototipo de referencia;
la entrada activa es `src/App.tsx`.

Los respaldos y las hojas Excel se entregan mediante el menú nativo de compartir
y guardar de Android. Los archivos que importas se eligen con el selector del
teléfono. La cámara y el micrófono piden permiso al usarlos; sus permisos están
declarados para que WebView pueda abrir el diálogo del sistema.

La WebView requiere conexión a internet y al dominio `mi.lukapp.app`. La
autenticación y los flujos externos usan las rutas y redirecciones ya
configuradas para la web.

Para ejecutar el cliente:

1. Copia `.env.example` como `.env` y configura la URL del proyecto y su clave
   pública `publishable` (o `anon`). Nunca copies aquí una clave `secret` o
   `service_role`.
2. Instala dependencias desde esta carpeta con `pnpm install`.
3. Ejecuta `pnpm start` y abre el proyecto en un emulador o dispositivo Android
   con Expo Go compatible con Expo SDK 58 o con el build de prueba.

## Crear builds Android

El archivo `eas.json` define un APK para distribución interna y un AAB para
Google Play. Los builds se compilan en Expo Application Services, así que no
requieren Android Studio instalado en este Mac.

1. Inicia sesión con una cuenta de Expo: `pnpm dlx eas-cli login`.
2. El proyecto ya está vinculado con `@lukapp/julian-gonzalez`; su ID de EAS
   está guardado en `app.json`.
3. Las variables `EXPO_PUBLIC_SUPABASE_URL` y
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ya están configuradas localmente y en
   los entornos EAS de desarrollo, prueba y producción. La clave publishable
   es pública para clientes; nunca uses `secret` ni `service_role`.
4. Genera el instalador de prueba:

   ```sh
   pnpm dlx eas-cli build --platform android --profile preview
   ```

5. Para Play Console, genera el paquete de publicación:

   ```sh
   pnpm dlx eas-cli build --platform android --profile production
   ```

El primer build puede pedir crear/guardar la credencial de firma Android. Debe
ser la misma clave de carga asociada a la app `lukApp.App` en Play Console. Si
Play ya tiene una clave de carga activa o un restablecimiento pendiente, no
subas el AAB hasta confirmar cuál credencial acepta Play. El `versionCode`
actual de desarrollo es `1010012`; debe ser superior al último código que Play
acepte para ese paquete. El export de Expo para Metro no es un APK ni un AAB.

## Plan para que web y Android evolucionen juntos

1. **Base nativa:** acceso, sesión segura, navegación nativa, estados de carga y
   errores accesibles. Completar recuperación de contraseña, Google OAuth y
   reglas de registro antes de invitar probadores.
2. **Dominio compartido:** los cálculos usados por Inicio y movimientos ya se
   importan de la fuente de la PWA. Extender ese patrón a los siguientes módulos
   y, donde convenga, consolidarlos en un paquete común independiente de React y
   del navegador. Ningún cálculo financiero debe duplicarse en una pantalla.
3. **Paridad de producto:** migrar por módulos Inicio, movimientos, cuentas,
   presupuestos, informes, asesor y ajustes. Cada módulo debe tener un criterio
   de paridad comprobable antes de marcarse como disponible en Android.
4. **Capacidades Android:** integrar permisos y APIs nativas para notificaciones
   y recordatorios, bloqueo biométrico opcional, cámara/OCR, selección y
   compartición de archivos, dictado y tareas de sincronización. Cada permiso se
   pedirá al usar la función y explicará para qué se necesita.
5. **Publicación:** integrar Google Play Billing para funciones digitales de
   pago, validar compras del lado del servidor, completar privacidad y
   declaraciones de Play Console, probar en dispositivos reales y publicar
   primero en una prueba cerrada.

Las funciones del negocio y los datos viven en el backend compartido. Los
controles, la navegación y las integraciones con el teléfono son propios de
cada plataforma. Al cambiar una regla financiera, la implementación común y
sus consumidores se actualizan como parte del mismo cambio; una capacidad que
solo exista en Android se identificará como tal dentro del plan de paridad.

## Versiones y builds

La versión visible sigue `src/version.ts` en la raíz. Al cerrar cada entrega se
actualizan juntas la PWA y esta aplicación, y se construye una nueva versión
Android (`versionCode`) para Play. El ID `lukApp.App` permanece sin cambios.
