# Auditoría de datos para la app Android nativa (Kotlin + Compose)

Código auditado: **LukApp v10.14.0** (`src/version.ts:43`, rama `android-nativo`).
Objetivo: que la app Kotlin hable con **el mismo backend** (Supabase + API Express)
y reproduzca **los mismos resultados** que la web. Todas las rutas son relativas a
la raíz del repo. No se incluyen valores secretos, solo nombres de variables.

---

## 1. Cliente Supabase y autenticación

### 1.1 Cliente

| Aspecto | Web (`src/`) | App Expo actual (`apps/mobile/`) | Qué hacer en Kotlin |
|---|---|---|---|
| Creación | `createClient(URL, ANON_KEY, {auth:{persistSession:true, autoRefreshToken:true}, global:{fetch: crearFetchTolerante(...)}})` — `src/features/lukapp/data/supabase.ts:40-60` (singleton `obtenerSupabase`) | `createClient(url, publishableKey, {auth:{storage: almacenamientoSeguro, autoRefreshToken, persistSession, detectSessionInUrl:false}})` — `apps/mobile/src/lib/supabase.ts:85-94` | `supabase-kt` (Auth + Postgrest + Functions opcional) con un único cliente. |
| Variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (preferida) o `VITE_SUPABASE_ANON_KEY` — `supabase.ts:15,27-28` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — `apps/mobile/src/lib/supabase.ts:6-7` | `BuildConfig.SUPABASE_URL`, `BuildConfig.SUPABASE_PUBLISHABLE_KEY`. **Nunca** `SUPABASE_SERVICE_ROLE_KEY`. |
| Sin configuración | Devuelve `null` → modo solo-local (IndexedDB) — `supabase.ts:30,38` | `supabase = null` | Decidir si Android admite modo sin cuenta. |
| Almacenamiento de sesión | `localStorage` (por defecto supabase-js, clave `sb-<ref>-auth-token`) | SecureStore (Android Keystore), troceado en partes de 1700 car. con índice `generación:n` y prefijo `lukapp.auth.` — `apps/mobile/src/lib/supabase.ts:8-83` | `SessionManager` cifrado (EncryptedSharedPreferences / DataStore + Keystore). |
| Refresco | `autoRefreshToken`; `onAuthStateChange` actualiza estado — `useSesion.ts:104-113` | `startAutoRefresh/stopAutoRefresh` según `AppState` — `apps/mobile/src/lib/supabase.ts:96-101` | Igual: pausar refresco en background (`ProcessLifecycleOwner`). |
| Sesión inválida al arrancar | Si `getSession()` falla por 429 (`esLimiteDeRenovacion`) o refresh token revocado/usado/vencido (`esSesionGuardadaInvalida`): `signOut({scope:'local'})` + mensaje — `useSesion.ts:75-93, 321-342` | — | Replicar: códigos `refresh_token_not_found`, `refresh_token_already_used`, `session_expired`, `session_not_found`. |
| Desfase de reloj | `crearFetchTolerante` reintenta respuestas "issued at future / not yet valid" con esperas 400/1200/2500 ms, máx 8 s — `data/fetchTolerante.ts` | — | Interceptor OkHttp/Ktor equivalente. |
| Tiempo límite login | 12 s (`conTiempoLimite`) — `useSesion.ts:303-319` | — | `withTimeout(12_000)`. |
| Traducción de errores | `traducir()` — `useSesion.ts:370+` | `traducirError` en `AppNativa.tsx` | Portar tabla de mensajes en español. |
| Modo desarrollo | `localhost:5173` usa identidad fija `usuario-local-pruebas` sin Supabase — `useSesion.ts:35-44` | — | No aplica. |

### 1.2 Flujos de autenticación

| Flujo | Implementación web | Detalle a portar |
|---|---|---|
| Entrar email/contraseña | `signInWithPassword({email: email.trim(), password})`; alias `demo` → `demofestech@lukapp.app` — `useSesion.ts:147-151` | Alias demo; el servidor protege esa cuenta (`server.ts` `CUENTA_DEMO`, ~l. 642). Recordar correo: `localStorage` `lukapp_correo_guardado` / `lukapp_recordar_usuario` — `LoginPanel.tsx:62,131-135`. |
| Registro | `signUp({email, password, options:{data:{usuario}}})` — `useSesion.ts:195-205`. El trigger `crear_perfil` lee `usuario` de la metadata y crea la fila de `perfiles` — `supabase/migrations/0017_registro_publico.sql:57` | El apodo **solo** puede fijarse aquí (no hay política de insert en `perfiles`). |
| Disponibilidad de apodo | `rpc('usuario_disponible', {nombre})`; ante error devuelve `true` — `useSesion.ts:269-278`, función `0017_registro_publico.sql:31` | Debounce + mismo comportamiento "fail-open". |
| Validación de contraseña (registro) | `LARGO_MINIMO_CONTRASENA = 6` y `REQUISITOS_CONTRASENA` (largo ≥6, `[A-Z]`, `[a-z]`, especial `[^A-Za-z0-9\s]`) + no igual a usuario/correo (comparación `trim().toLocaleLowerCase('es-CO')`) — `src/lib/seguridad.ts:2-74` (test `src/lib/seguridad.test.ts`). Checklist visual `components/ChecklistContrasena.tsx:25-62`; uso `LoginPanel.tsx:112-114, 483-503`. Otras reglas: máx 128 car., apodo 3–30 `[a-zA-Z0-9_-]` — `components/loginValidation.ts:14-88` | **Inconsistencia:** `apps/mobile/src/AppNativa.tsx` (~l. 199, 230) exige `length < 8` y no aplica la checklist. Kotlin debe usar las reglas de `seguridad.ts`. El servidor también valida con `validarContrasenaSegura` (`server.ts:11`). |
| Bloqueo por intentos | `INTENTOS_MAX_LOGIN = 5`, `LOCKOUT_MINUTOS = 15`, `isLockedOut`, `getLockoutRemainingMinutes` — `loginValidation.ts:17-18,136-168` | Lógica solo de cliente. |
| Recuperar contraseña | `resetPasswordForEmail(email, {redirectTo: origin + '/entrar'})`; luego POST `/api/mi-cuenta/contrasena-cambiada` si hay sesión — `useSesion.ts:207-238`. Detección de modo recuperación por `type=recovery` en hash/query o evento `PASSWORD_RECOVERY` — `useSesion.ts:57-62,107-109`. Vista `components/PasswordRecoveryView.tsx:32` | En Kotlin: `redirectTo = lukapp://auth/callback`, capturar deep link con `type=recovery`, mostrar pantalla "nueva contraseña". |
| Cambiar contraseña | `updateUser({password})` — `useSesion.ts:240-262`, `components/CuentaView.tsx:306` | Igual. |
| Google OAuth (web) | `signInWithOAuth({provider:'google', options:{redirectTo: origin + '/app'}})` — `useSesion.ts:169-176` | — |
| Google OAuth (WebView Android actual) | Si `window.__LUKAPP_NATIVE__` y `ReactNativeWebView`: con `__LUKAPP_GOOGLE_NATIVO__` pide la URL con `{redirectTo: REDIRECCION_NATIVA, skipBrowserRedirect:true}` y la envía por `postMessage({tipo:'lukapp:google', url})`; sin la bandera → error "app vieja" — `useSesion.ts:164-188, 344-366`. `REDIRECCION_NATIVA = 'lukapp://auth/callback'` (`useSesion.ts:345`). La app inyecta `__LUKAPP_GOOGLE_NATIVO__ = true` (`apps/mobile/src/App.tsx:31-35`), valida que la URL sea `https://…/auth/v1/authorize`, abre `WebBrowser.openAuthSessionAsync(enlace, 'lukapp://auth/callback')` y recarga el WebView con el `search`+`hash` devueltos — `App.tsx:277-292` | Flujo **implícito** (tokens en el fragmento). En Kotlin: `supabase-kt` `signInWith(Google)` vía Custom Tabs con esquema `lukapp`, host `auth`, path `/callback` (ya declarado: `apps/mobile/app.json` `"scheme": "lukapp"`, package `lukApp.App`). Preferible PKCE. Alternativa: Credential Manager + `signInWithIdToken`. La URL debe seguir en Supabase → Auth → URL Configuration. |
| Deep link (pantalla nativa Expo) | `AppNativa.tsx:120-141`: une query+hash, lee `access_token`, `refresh_token`, `type`, `error_code`; `setSession(...)` | Referencia directa para el `Intent` handler. |
| Cerrar sesión | `signOut()` global; si hay suplantación (`sessionStorage.__admin_session_backup__`) → `signOut({scope:'local'})` y borra `__admin_session_backup__`, `__impersonated_user__` — `useSesion.ts:286-301` | Suplantación es solo superadmin web; en Android basta `signOut()`. |
| Preferencias en la cuenta | `updateUser({data:{[clave]: valor}})` y `sincronizarDesdeSupabase(user_metadata)` al iniciar sesión — `data/usePreferencias.ts:63-126`, `useSesion.ts:97-99` | Ver §3.2: las claves `finanzas:*` viven también en `user_metadata`. |

### 1.3 Roles

| Concepto | Dónde |
|---|---|
| `perfiles.rol ∈ {'admin','usuario'}` (+ `rol_personalizado_id`, `ultimo_acceso_app_at`) | `migrations/0002_perfiles_y_roles.sql:8-16`, `0015_roles_personalizados.sql:62` |
| `es_admin()` SECURITY DEFINER | `0002_perfiles_y_roles.sql:31` |
| Roles personalizados: `roles`, `permisos`, `permisos_por_rol`, `tiene_permiso(text)` | `0015_roles_personalizados.sql:14-75` |
| El cliente pide rol/permisos a `GET /api/mis-permisos` (no lee tablas) | `src/apps-dashboard/AppsRoot.tsx:264-303`; acceso superadmin = `rol==='admin' \|\| permisos.length>0` (`AppsRoot.tsx:365`) |
| Servidor: `exigirUsuario`, `exigirAdmin`, `exigirPermiso`, `exigirGestionUsuarios` (validan JWT con `auth.getUser(token)` usando service role) | `server.ts:644-764` |
| `perfiles`: lectura propia o admin; update solo del apodo sin poder cambiar `rol`/`email`/`rol_personalizado_id` | `0002:79-81`, `20261110120000_cerrar_escalada_rol_personalizado.sql:10-21` |
| Límite de admins | `20261029213829_limitar_administradores_a_dos.sql`, revisado en `20261106120000_permitir_mas_superadmins.sql` |

> Recomendación: el panel superadmin no se porta a Android en la primera fase; solo leer `/api/mis-permisos` si se quiere mostrar un acceso.

---

## 2. Esquema de datos

Todas las tablas financieras usan RLS `for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)` (`0001_finanzas.sql` bloque `do $$`; idéntico en 0007–0010). Montos en **COP enteros** (`bigint`). Fechas de negocio en `date` (día de Bogotá, `YYYY-MM-DD`), timestamps en `timestamptz` ISO.

### 2.1 Tablas financieras (núcleo)

| Tabla | Columnas clave (tipo) | Restricciones | Migraciones | Modelo TS |
|---|---|---|---|---|
| `transacciones` | `id uuid PK`, `user_id`, `kind text` ∈ gasto/ingreso/transferencia, `amount_cop bigint >0`, `category text`, `description text ''`, `occurred_on date`, `raw_transcript text ''`, `cuenta_id uuid → cajitas ON DELETE SET NULL`, `afecta_saldo bool default true`, `cuotas_total int`, `cuota_cop bigint`, `created_at` | índice `(user_id, occurred_on desc)` | `0001:12`, `0006`, `20260830183300`, `20260830190000`, `20261021034845` | `Transaction` — `types.ts:118-148` |
| `cajitas` (cuentas, cajitas, deudas, tarjetas) | `id uuid`, `nombre`, `emoji text '🐷'` (= `icon`), `tipo` ∈ cuenta/cajita/deuda/tarjeta, `clase_cuenta` ∈ efectivo/banco/billetera, `meta_cop bigint>0`, `tasa_ea_pct numeric(6,3) 0–200`, `archived_at`, `limite_credito_cop`, `dia_corte smallint`, `dia_pago smallint`, `pago_minimo_cop`, `es_bajo_monto bool`, `es_inversion bool`, `moneda text ^[A-Z]{3}$ default 'COP'` | `cajitas_tarjeta_config_valida` | `0001:30`, `0003`, `0004`, `0005`, `20260828121945`, `20260905090000`, `20260906183502`, `20261020163602`, `20261021133216` | `Cajita` — `data/modelos.ts:50-86` |
| `cajita_movimientos` | `id uuid`, `cajita_id → cajitas CASCADE`, `kind` ∈ deposito/retiro/rendimiento/valoracion/ajuste/compra/abono, `delta_cop bigint` (con signo), `occurred_on date`, `nota text`, `categoria text`, `cuotas_total`, `cuota_cop`, `interes_pct numeric`, `cuota_manejo_cop`, `monto_original numeric(20,6)`, `moneda_original`, `tasa_cambio_cop numeric(20,8)` | índice `(user_id,cajita_id,occurred_on)` | `0001:43`, `0005`, `20261020163602`, `20261021133216` | `CajitaMovimiento` — `modelos.ts:107-132` |
| `metas` | `id`, `nombre`, `emoji '🎯'`, `objetivo_cop >0`, `fecha_objetivo date`, `cajita_id → SET NULL`, `ahorrado_cop >=0`, `completed_at` | | `0001:62` | `Meta` — `modelos.ts:232-245` |
| `categorias` (propias) | `id text PK` (formato `p-…`), `nombre`, `icon 'Package'`, `color '#A8A29E'`, `archived_at` | único parcial `(user_id, lower(nombre))` no archivadas | `0007:12` | `CategoriaPersonal` — `categorias.ts` |
| `contactos` | `id text`, `nombre`, `alias text[]`, `separado_de text[]`, `apodos text[]`, `archived_at` | | `0008:11`, `0011` | `Contacto` — `lib/contactos.ts` |
| `presupuestos` | PK `(user_id, categoria)`, `monto_cop >0`, `created_at` | sin FK a categorías (básicas viven en código) | `0009:10` | `Presupuesto` — `lib/presupuestos.ts:10-14` |
| `recurrentes` | `id uuid`, `nombre`, `kind` gasto/ingreso, `amount_cop >0`, `categoria`, `cuenta_id → SET NULL`, `dia_del_mes 1–31`, `archived_at` | | `0010:7` | `Recurrente` — `lib/recurrentes.ts:5-15` |
| `revisiones_dudosas` | `id`, `tipo` movimiento/documento/transferencia, `estado` pendiente/resuelta/descartada, `referencia_id`, `titulo`, `detalle`, `documento`, `resolucion`, `created_at`, `updated_at` | políticas CRUD propias | `20261021122018:1` | `RevisionDudosa` — `data/revisiones.ts` |
| `operaciones_financieras` | PK `(user_id,id)`, `huella text` (md5 de `cambios`) | select/insert propios | `20261020163602:10` | idempotencia de la RPC |

Categorías básicas (no están en BD): `CATEGORIES` = mercado, comida, transporte, servicios, salud, hogar, entretenimiento, ropa, educacion, transferencia, ahorro, ingreso, otros — `types.ts:3-17`; etiquetas `types.ts:27-41`; colores `types.ts:85-99`; emojis `categorias.ts:140`.

Cuenta Efectivo: id fijo local `00000000-0000-4000-8000-0000000000ef` (`modelos.ts:164`), legado `'efectivo'` (`modelos.ts:174`); con cuenta en la nube el id se deriva: `SHA-256("lukapp:efectivo:" + userId)` → 16 bytes, bytes[6]=(b&0x0f)|0x80, bytes[8]=(b&0x3f)|0x80, formato UUID — `lib/id.ts` `idEfectivoParaUsuario`. IDs nuevos: `crypto.randomUUID()` (`lib/id.ts` `nuevoId`).

### 2.2 RPC

| RPC | Firma | Quién la llama | Notas |
|---|---|---|---|
| `aplicar_cambios_financieros` | `(cambios jsonb, id_operacion uuid) returns void`, SECURITY INVOKER | `RepositorioSupabase.aplicarCambios` — `data/repositorioSupabase.ts:221-242` | Versión vigente `20261023125520_eliminar_modulo_tu_trabajo.sql:2`. `cambios = {guardar:{tabla:[filas snake_case]}, borrar:{tabla:[ids]}, reemplazar:bool}`; tablas permitidas: cajitas, categorias, contactos, presupuestos, recurrentes, metas, transacciones, cajita_movimientos, revisiones_dudosas. Lock por usuario, idempotente por `id_operacion` (misma huella → no-op; huella distinta → error). Borra en orden transacciones→metas→movs→recurrentes→cajitas→categorias→contactos→presupuestos→revisiones, luego upsert dinámico; valida que `cuenta_id`/`cajita_id` sean del usuario y que no haya columnas desconocidas. Clave de presupuestos = `categoria`. `reemplazar:true` borra todo antes (restaurar/vaciar). |
| `usuario_disponible` | `(nombre text) → bool` | `useSesion.ts:272`, `AppNativa.tsx:165` | Público para registro. |
| `crear_espacio_compartido` | `(nombre_espacio, icono_espacio, color_espacio) → uuid` | `data/useEspaciosCompartidos.ts:67` | Última versión `20260924002440:265` (consume cupo de plan). |
| `crear_invitacion_compartida` | `(espacio uuid) → token` | `useEspaciosCompartidos.ts:100` | |
| `aceptar_invitacion_compartida` | `(token_invitacion uuid, nombre_integrante, emoji_integrante)` | `useEspaciosCompartidos.ts:105` | Última versión `20260924002440:318`. |
| Solo servidor (service role) | `consumir_cupo_plan`, `devolver_cupo_plan`, `plan_vigente_de`, `crear_intento_pago_wompi`, `activar_premium_pasarela`, `otorgar_premium_manual`, `cancelar_premium_manual`, `administrar_premium_superadmin`, `actualizar_plan_con_beneficios`, `aprobar_solicitud_superadmin`, `buscar_contexto_ia`, `resumir_visitas`, `purgar_*` | `server.ts` | Android nunca las llama directo. |

### 2.3 Lecturas/escrituras por módulo

**`data/repositorioSupabase.ts`** (repositorio remoto del libro financiero):

| Operación | Consulta | Línea |
|---|---|---|
| `cargarTodo` (9 tablas en paralelo) | `from(t).select('*', {count:'exact'}).eq('user_id', uid).order(clave).range(n, n+499)` paginado de 500 hasta `count`; `clave='id'` salvo presupuestos `'categoria'`. Tablas: transacciones, cajitas, cajita_movimientos, metas, categorias, contactos, presupuestos, recurrentes, revisiones_dudosas | 119-180 |
| `guardarTransacciones` | `from('transacciones').upsert([...])` | 182-188 |
| `borrarTransaccion` | `from('transacciones').delete().eq('id', id)` | 190-193 |
| `guardarCajita` / `borrarCajita` | `upsert` / `delete().eq('id')` (cascade en BD) | 195-206 |
| `guardarCajitaMovimientos` / `borrarCajitaMovimiento` | `upsert` / `delete().eq('id')` | 208-219 |
| `aplicarCambios`, `guardarMovimientosConTransaccion`, `borrarMovimientoConTransaccion`, `vaciar` | `rpc('aplicar_cambios_financieros', …)` | 221-253, 330-332 |
| metas, categorías, contactos, recurrentes | `upsert` / `delete().eq('id')` | 255-327 |
| presupuestos | `upsert({user_id, categoria, monto_cop, created_at})`; borrar `delete().eq('user_id').eq('categoria')` | 300-316 |
| Mapeos fila↔modelo | `aTransaccion`/`desdeTransaccion` (cuotas solo si `cuotas_total >= 2`; `afecta_saldo !== false`), `aCajita`/`desdeCajita` (campos de tarjeta solo si `tipo='tarjeta'`, `clase_cuenta` solo si `cuenta`, `es_inversion`/`moneda` solo si `cajita`), `aMovimiento`, `aMeta`, `aRecurrente`, `aRevision`, `aPresupuesto`, `aContacto`, `aCategoria` | 339-675 |
| Traducción de errores Postgres → español | `fallar()` (`amount_cop_check`, RLS, JWT, `duplicate key`, schema cache…) | 51-117 |

**Otros módulos que tocan tablas directamente:**

| Tabla | Módulo | Consulta |
|---|---|---|
| `perfiles` | `components/CuentaView.tsx:170-176` | `select('usuario').eq('id', userId).maybeSingle()` |
| `espacios_integrantes`, `espacios_compartidos` | `data/useEspaciosCompartidos.ts:34` | `select('espacio_id, espacios_compartidos(id,nombre,icono,color,created_at)').eq('user_id', uid)` |
| `espacios_integrantes` | `useEspaciosCompartidos.ts:39` | `select('espacio_id,user_id,nombre,emoji').in('espacio_id', ids)` |
| `gastos_compartidos` | `useEspaciosCompartidos.ts:40, 83, 90, 95` | `select('id,espacio_id,descripcion,monto_cop,fecha,pagado_por,categoria').in('espacio_id', ids).order('created_at', desc)`; `insert({espacio_id, creado_por, pagado_por, descripcion, monto_cop, categoria})`; `delete().eq('id')`; saldar: `delete().eq('espacio_id')` |
| `funciones_solicitadas`, `_votos` | `components/FuncionesSolicitadasView.tsx:40-47, 86-97, 133-140` | `select('id,titulo,descripcion,votos').order('votos',desc).order('creada_en',desc)`; votos `select('funcion_id')`; votar `insert`/`delete().eq('funcion_id').eq('user_id')`; proponer `insert({titulo, descripcion, creada_por})` |
| `comprobantes_correo` | `components/AnalistaView.tsx:87-88` | `select('id,remitente,asunto,recibido_en,adjuntos').order('recibido_en',desc).limit(20)` |
| `suscripciones_push` | `lib/notificacionesPush.ts:22-24, 34` | `upsert({user_id, endpoint, suscripcion}, {onConflict:'user_id,endpoint'})`; `delete().eq('user_id').eq('endpoint')` |
| `visitas` | `src/apps-dashboard/EstadisticasPanel.tsx:244` | superadmin (no portar) |

Tablas solo de servidor (no tocar desde Android): `ia_conversaciones`, `ia_mensajes`, `ia_memoria_usuario`, `ia_analisis_usuario` (`0021`), `telemetria_ia`, `planes_suscripcion`, `suscripciones`, `consumos_plan_mensual`, `eventos_facturacion`, `beneficios_plan`, `intentos_pago_wompi`, `llaves_atajo`, `comprobantes_correo_destinos`, `registro_auditoria`, `solicitudes_superadmin`, `documentos_legales`, `ia_contexto_*`, `visitas*`. (`documentos_negocio` fue eliminada en `20261023125520`.)

---

## 3. Persistencia local

### 3.1 IndexedDB y cola offline

| Elemento | Detalle | Archivo |
|---|---|---|
| Base sin cuenta | `finanzas`, versión `9` | `data/indexeddb.ts:22-24` |
| Base con cuenta | `finanzas-nube-<userId>` (caché + cola en la misma base, aislada por usuario) | `LukAppApp.tsx:303-327` |
| Stores | `transacciones`, `cajitas`, `cajitaMovimientos` (índice `porCajita`→`cajitaId`), `metas`, `categorias`, `contactos`, `presupuestos` (keyPath `categoria`), `recurrentes`, `revisiones` (keyPath `id`), `colaPendiente` (autoIncrement); se borra `documentosNegocio` | `indexeddb.ts:26-43, 129-160` |
| Cola | `ColaCambios`: guarda `{metodo, args}` del repositorio en orden; `listar/quitar/contar` | `data/colaCambios.ts:16-60` |
| Sincronización | `RepositorioConCola`: escribe local + encola; `sincronizar()` sube en orden y se detiene en el primer fallo (red o no); `cargarInicial` devuelve caché si hay datos; `leerTodo` sincroniza pendientes, y si la cola queda vacía lee remoto y lo espeja; **si remoto viene vacío y local no, conserva local** con aviso | `data/repositorioConCola.ts:76-200` |
| Migración del libro sin cuenta | `migrarLibroLocal` copia `finanzas` → cuenta (cajitas primero vía RPC); marca `localStorage lukapp-migracion-local-v1:<uid> = 'completa'` | `indexeddb.ts:70-118`, `repositorioConCola.ts:155-166` |
| Equivalente Kotlin | Room (una BD por usuario) con las 9 tablas + tabla `cola_pendiente(id autoincrement, metodo, args_json)` y WorkManager para reintentos. Preferir encolar **`CambiosFinancieros` + `idOperacion`** para aprovechar la idempotencia de la RPC. | — |

### 3.2 localStorage / sessionStorage

| Clave | Contenido | Archivo | ¿Sincroniza en `user_metadata`? |
|---|---|---|---|
| `finanzas:resumen:ahorro` | `si/no` contar ahorros en el total | `data/usePreferencias.ts:19` | Sí |
| `finanzas:resumen:efectivo-separado` | `si/no` | `:20` | Sí |
| `finanzas:resumen:decisiones` | `si/no` | `:21` | — |
| `finanzas:inicio:proximos-pagos` | `si/no` | `:22` | Sí |
| `finanzas:modo-privacidad` | ocultar montos | `:23`, `data/usePrivacyMode.ts:10` | Sí (updateUser) |
| `finanzas:recordatorio-racha:activo` / `:hora` / `:ultimo-envio` | recordatorio diario | `usePreferencias.ts:24-25`, `lib/recordatorioRacha.ts:1` | — |
| `finanzas:onboarding:nombre` / `:terminado` | nombre y bienvenida (nunca baja a `no` desde nube) | `:26-27` | Sí |
| `finanzas:guia:basica` / `:secciones` | guía (JSON) | `:28-29` | Sí |
| `finanzas:gmf:uvt` | `ValorUvt` JSON | `:30` | Sí |
| `finanzas:gmf:cuentas` | ids de cuentas cubiertas por 4x1000 (JSON) | `:32` | Sí |
| `finanzas:gmf:regimen` | `distribuido` / `marcada` | `:33` | Sí |
| `finanzas:gmf:cuenta-exenta` | id | `:34` | Sí |
| `finanzas:periodo` | `ConfigPeriodo` JSON | `:36` | Sí |
| `finanzas:novedades:version-vista` | última versión vista | `:37` | Sí |
| `finanzas:presupuestos:alertas-activas` / `:umbral-alerta` | `si/no`, número (def. 80) | `:38-39` | Sí |
| `finanzas:cuenta-favorita` | id | `:40` | Sí |
| `finanzas:tema` | tema | `data/useTema.ts:13` | — |
| `dismissed-insights` | insights descartados | `data/useDismissedInsights.ts:3` | — |
| `finanzas.analista.token` | token analista (legado) | `analista/useAnalista.ts:7` | — |
| `lukapp_vaquitas_v1` | vaquitas locales | `components/VaquitasModal.tsx:20` | — |
| `lukapp_correo_guardado`, `lukapp_recordar_usuario` | login | `LoginPanel.tsx:55-135` | — |
| `lukapp_atribucion_marketing` (session), `lukapp_analitica_detallada` | analítica | `src/lib/visita.ts:11-12` | — |
| `__fin_mic_pedido` | permiso de micrófono pedido | `hooks/usePermisoDeMicrófono.ts` | — |
| `lukapp-instalacion-pwa-v2`, `lukapp-proxima-invitacion-premium-v*`, `lukapp-ultima-pose-luki` (session) | UX web | `AppsRoot.tsx:110`, `InvitacionPremium.tsx`, `Estrella*` | — |
| `__admin_session_backup__`, `__impersonated_user__` (session) | suplantación superadmin | `useSesion.ts:300-301` | — |

Kotlin: DataStore para preferencias, escribiendo las mismas claves en `user_metadata` (`auth.updateUser { data = … }`) y leyéndolas al iniciar sesión para compartir ajustes con la web. Formato: booleanos JSON en metadata (`true/false`), objetos JSON tal cual.

---

## 4. Endpoints HTTP propios

**Base URL:** `apiUrl(ruta) = BASE + ruta`; `BASE = VITE_API_URL` o, en producción, `https://focus-62nt.onrender.com` — `src/lib/api.ts:14-19`. Render (Express `server.ts`) sirve todo `/api/*`. Vercel tiene dos funciones edge: `api/transcribir.ts` y `api/visita.ts` (`vercel.json` rewrites). `netlify.toml` redirige `/api/*` a Render. **No hay funciones de Netlify** en el repo. Precalentamiento: `GET /api/salud` con timeout 55 s, como máximo una vez por minuto (`api.ts:21-55`), porque Render gratis se duerme.

**Autenticación:** `Authorization: Bearer <access_token de Supabase>`; el servidor valida con `auth.getUser(token)` (service role). CORS permite `Authorization`, `Content-Type`, `X-Api-Key`, `X-Lukapp-Transcription-Mode`, `X-Lukapp-Vocabulario` (`server.ts:110-124`). Límite global 120 req/min/IP; límites por ruta en `server.ts:152-162`. Cuerpo JSON ≤ 6 MB; audio crudo ≤ 8 MB.

### 4.1 Endpoints de usuario (a portar)

| Ruta | Método | Auth | Cuerpo | Respuesta | Pantalla | Línea |
|---|---|---|---|---|---|---|
| `/api/salud` | GET | — | — | estado/proveedores/versión | precalentar | `server.ts:2823` |
| `/api/transcribir` | POST | Bearer (obligatorio si hay Supabase) | audio crudo; `Content-Type: audio/mp4\|webm…`; `X-LukApp-Transcription-Mode: final` (parcial está desactivado); `X-LukApp-Vocabulario: encodeURIComponent(JSON.stringify(string[≤30]))` | `200 {success:true, text, calidad?:'alta'\|'media'\|'baja'}` o `200 {offline:true, error}`; `401`, `413`, `429 {codigo:'cupo-agotado'}` | Dictado | `server.ts:4361-4430`; edge `api/transcribir.ts` |
| `/api/asesor-ia/disponibilidad` | GET | Bearer | — | `{ok, ia}` | Asesor | `server.ts:3569` |
| `/api/asesor-ia` | POST | Bearer | `{prompt, history (últimos 5), finanzasContext, memoriaUsuario: string[], idConsulta}` | `200 {success, text, provider, offline:false}` o `{offline:true, motivo}`; `429 cupo-agotado`, `503` | Asesor IA (servidor relee el perfil financiero real) | `server.ts:3862-4100`; cliente `AsesorView.tsx:799-810` |
| `/api/asesor-ia/respaldo-local` | POST | Bearer opcional | `{idConsulta, prompt, respuestaTexto, motivo}` | `202 {persistida}` | Asesor (telemetría del motor local) | `server.ts:4103` |
| `/api/asesor/conversaciones` | GET / POST | Bearer | POST `{titulo}` | `{conversaciones}` / `201 {conversacion}` | Asesor | `server.ts:3598, 3609` |
| `/api/asesor/conversaciones/:id/mensajes` | GET | Bearer | — | `{mensajes}` | Asesor | `server.ts:3621` |
| `/api/asesor/mensajes` | POST | Bearer | `{conversacionId, rol:'user'\|'assistant', texto, proveedor}` | `201 {ok}` | Asesor | `server.ts:3648` |
| `/api/asesor/memoria` | GET | Bearer | — | `{memoria}` | Asesor | `server.ts:3664` |
| `/api/asesor/memoria/:id` | DELETE | Bearer | — | `{ok}` (marca `activa=false`) | Asesor | `server.ts:3675` |
| `/api/finanzas-insights-ia` | POST | Bearer + beneficio `insights_ia` | `{}` | `{success, insights[], provider, model}`; `403 beneficio-no-incluido` | Insights (`hooks/useAiInsights.ts:152`) | `server.ts:4233` |
| `/api/analizar-extracto` | POST | Bearer (+ cupo `extractos`) | `{pdfBase64, contrasena?}` | `{ok:true, resultado: AnalisisResultado}` o `{ok:false, codigo, mensaje}` (401/400/413/422/429/503) | Análisis de extractos (`analista/useAnalista.ts:8`) | `server.ts:2680`; tipos `analista/tipos.ts:61-81` |
| `/api/comprobantes-correo/destino` | GET | Bearer | — | `{direccion}` | Análisis → comprobantes por correo | `server.ts:878` |
| `/api/comprobantes-correo/:id/adjunto/:adjuntoId` | GET | Bearer | — | binario | idem | `server.ts:899` |
| `/api/mi-plan` | GET | Bearer | — | `{codigo, nombre, precios, preciosPremium, limites, limitesPremium, beneficios, beneficiosPremium, consumo:{dictados, asesorIa, extractos}, suscripcion}` | Cuenta, Premium, insights | `server.ts:2209`; armado ~`server.ts:560-640` |
| `/api/pagos/wompi/checkout` | POST | Bearer | `{ciclo:'mensual'\|'anual'}` | `{destino:'https://checkout.wompi.co/p/', campos:{public-key, currency:'COP', amount-in-cents, reference, signature:integrity, redirect-url, expiration-time}}`; `409` | Cuenta → Premium (`CuentaView.tsx`) | `server.ts:2228-2318` |
| `/api/pagos/wompi/webhook` | POST | firma Wompi | evento | — | (servidor; activa Premium) | `server.ts:2319` |
| `/api/mi-cuenta/eliminar` | POST | Bearer | — | — (demo prohibida) | Cuenta | `server.ts:1573` |
| `/api/mi-cuenta/contrasena-cambiada` | POST | Bearer | — | — (auditoría) | Recuperación / Cuenta | `server.ts:1614` |
| `/api/registrar-ultimo-acceso` | POST | Bearer | — | — | Arranque (`AppsRoot.tsx`) | `server.ts:948` |
| `/api/mis-permisos` | GET | Bearer | — | `{rol, permisos[]}` | Arranque | `server.ts:2170` |
| `/api/legal/terminos` | GET | — | — | términos vigentes | Legal | `server.ts:1378` |
| `/api/atajos/llave` | POST / GET | Bearer | POST `{etiqueta}` | llave (una vez) / pista | Ajustes → Atajos | `server.ts:2859, 2895` |
| `/api/atajos/revocar` | POST | Bearer | — | — | idem | `server.ts:2920` |
| `/api/atajo/movimiento` | POST | llave de atajo (`Authorization` o `X-Api-Key`) | texto/notificación Nequi | movimiento creado | Atajos de iOS/Tasker | `server.ts:2952` |
| `/api/visita` | POST | — | `{ruta, referente}` | 204 | analítica (edge Vercel) | `api/visita.ts:37-63` |

### 4.2 Endpoints de superadmin (no portar en fase 1)

`/api/crear-usuario`, `/api/editar-usuario`, `/api/eliminar-usuario`, `/api/impersonar-usuario`, `/api/superadmin/usuarios`, `/api/superadmin/visitas`, `/api/auditoria-logs`, `/api/metricas-ia`, `/api/roles`, `/api/crear-rol`, `/api/editar-rol`, `/api/eliminar-rol`, `/api/solicitudes-superadmin[/:id/aprobar]`, `/api/superadmin/legal/terminos` (GET/PUT), `/api/superadmin/facturacion`, `/api/superadmin/planes/:codigo` (PUT), `/api/superadmin/suscripciones/otorgar`, `/api/superadmin/suscripciones/:id` (PATCH), `/api/superadmin/suscripciones/:id/cancelar`, `/api/superadmin/ia/conocimiento[/:id]`, `/api/comprobantes-correo/webhook` (Resend) — `server.ts:236-3860`.

---

## 5. Reglas de negocio a portar con resultados idénticos

**Advertencias generales de portabilidad**

| Tema | Regla JS | Equivalente Kotlin |
|---|---|---|
| Redondeo | `Math.round` = medio hacia +∞ (`-2.5 → -2`) | `Math.round(x)` / `roundToLong()` en Kotlin hacen lo mismo. **No** usar `BigDecimal.HALF_UP` ni `HALF_EVEN`. |
| Porcentajes | `Math.round(x * 1000) / 10` (1 decimal) | igual con `Double` |
| Fechas | Strings `YYYY-MM-DD` del día en `America/Bogota`; comparación lexicográfica | `LocalDate` + `ZoneId.of("America/Bogota")`; serializar siempre ISO. |
| Fechas inválidas | `Date.UTC` normaliza (`2026-02-31` → `2026-03-03`); `shiftMonthDate` en `periodo.ts` puede generar días inexistentes | Replicar normalización (p. ej. `LocalDate.of(y,m,1).plusDays(d-1)`), no lanzar excepción. |
| `localeCompare` | Ordena strings; con `'es'` para nombres | `Collator.getInstance(Locale("es"))` para nombres; `compareTo` para fechas/ISO. |
| Montos | Enteros COP (`Number` ≤ 2^53) | `Long`. |
| Zona en `cuotasTarjeta.ts`/`tarjetas.ts` | Usan `new Date(y, m, 0)` local (solo aritmética de calendario) | `YearMonth.lengthOfMonth()`. |

### 5.1 Formato, fechas y periodos

| Función | Firma | Archivo | Test |
|---|---|---|---|
| `formatCop` | `(value: number) => string` → `Math.round`, signo `-`, `$`, miles con `.` **sin Intl** (`$1.234.567`, sin decimales) | `lib/formatCop.ts` | `formatCop.test.ts` |
| `formatCopOculto` | `(value, oculto?)` → `'$ ••••••'` | idem | sí |
| `formatSigned` | `(value, kind)` → prefijo `+` ingreso, `−` (U+2212) gasto, `↔` transferencia | idem | sí |
| `formatAmountInput` / `parseAmountInput` / `parseSaldoInput` / `conPuntos` | entrada de montos (solo dígitos; `>0` / `>=0`) | idem | sí |
| `bogotaDate(now?)`, `bogotaHora(now?)` (`%24`) | día/hora en Bogotá | `lib/localDate.ts` | `localDate.test.ts` |
| `shiftDays`, `daysBetween`, `shiftMonth`, `monthKey`, `dayLabel` ('Hoy','Ayer','d mmm'), `monthLabel`, `monthKeyLabel`, `monthKeyShort` | aritmética por UTC sobre strings | idem | sí |
| `asesorEnHorario` | 7 ≤ hora ≤ 21 Bogotá | idem | sí |
| `inicioDePeriodo`, `finDePeriodo`, `claveDePeriodo`, `enElPeriodo`, `diasDelPeriodo`, `diasTranscurridosEnPeriodo`, `etiquetaDePeriodo`, `periodoAdyacente` | `ConfigPeriodo {frecuencia: semanal\|quincenal\|quincenas-mes\|mensual\|personalizado\|todo-el-tiempo, desfaseDiasMensual, diasPersonalizados? (1–90, def. 14), fechaAnclaPersonalizada? (def. 2026-01-01)}`; semana empieza lunes; quincenal ancla `2024-01-01`; mensual puro → clave `YYYY-MM`; resto → clave = fecha de inicio; `todo` | `lib/periodo.ts:33-251` | `periodo.test.ts` |
| `festivosColombia`: `calcularDomingoPascua`, `obtenerFestivosColombia`, `esDiaHabilColombia`, `calcularFechaPagoColombia` | Ley Emiliani | `lib/festivosColombia.ts` | sí |

### 5.2 Saldos, cuentas, cajitas, deudas, tarjetas

| Función | Regla clave | Archivo | Test |
|---|---|---|---|
| `idsPasivos(cajitas)` | `ES_PASIVO`: deuda y tarjeta = true | `lib/cajitas.ts:20`, `modelos.ts:29-34` | `cajitas.test.ts` |
| `saldosPorCajita(movs, txs, pasivos)` | Σ `deltaCop` de movimientos + por cada tx con `cuentaId` y `afectaSaldo !== false` (excepto compras de tarjeta ya emparejadas): ingreso suma / gasto resta; **invertido en pasivos**. Transferencias (`kind='transferencia'`) tienen `cuentaId=null` y no cuentan. | `cajitas.ts:83-104` | sí |
| `emparejarComprasTarjeta` | empareja tx gasto en pasivo con mov `compra` por mismo id; legado: misma cajita+fecha+monto | `cajitas.ts:39-81` | sí |
| `saldoDeCajita` | **cuenta sin movimientos = 0** (`?? 0`) — regla v10.11.8: la UI muestra `$0`, ya no «Saldo pendiente»/«—» | `cajitas.ts:109` | sí; UI en `InicioView.test.tsx`, `Onboarding.test.tsx` |
| `ajusteHacia(actual, objetivo)` | `objetivo − actual` (mov `ajuste`) | `cajitas.ts:118`; uso `useAlmacen.ts:950-973` | sí |
| `historialDeCajita` | orden por `occurredOn`, luego `createdAt`; saldo acumulado; devuelve invertido | `cajitas.ts:135` | sí |
| `totalEnCajitas`, `resumenDeCajitas` (pct de meta 1 decimal, máx 100; orden desc por saldo), `totalPorTipo` | ignoran archivadas | `cajitas.ts:159-230` | sí |
| `patrimonio` | `deudasCop = |deudas| + |tarjetas|` (abs por tipo), `totalCop = cuentas + cajitas`, `neto = total − deudas` | `cajitas.ts:234-254` | sí |
| `totalVisible(cajitas, movs, txs, contarAhorros)` | resta solo deudas directas (no tarjetas) | `cajitas.ts:290-302` | `totalVisible.test.ts` |
| `esCuentaEfectivo`, `saldoEfectivo`, `saldoCuentasSinEfectivo` | efectivo por id fijo/legado o `claseDeCuenta==='efectivo'` | `cajitas.ts:316-345` | sí |
| `claseDeCuenta`, `etiquetaTipoCajita` | si no hay clase: nombre empieza "efectivo" → efectivo; contiene nequi/daviplata/dale/movii/rappi pay → billetera; si no, banco | `data/modelos.ts:199-211` | — |
| `componerCuentas(cuentas, favoritaId)` | orden con favorita | `lib/composicionCuentas.ts:16` | sí |
| Operaciones compuestas | `registrarMovimiento` (compra en tarjeta crea tx gasto con **mismo id**), `abonarDeuda` (abono −monto en deuda + retiro −monto en cuenta, notas «Pagado desde X»/«Abono a Y»), `transferirEntreCuentas` (retiro «Enviado a X» + depósito «Recibido de Y» + tx `transferencia` con `cuentaId=null`, categoría `transferencia`), `fijarSaldo` | `data/useAlmacen.ts:737-973` | `useAlmacen.test.ts` |
| Tarjetas: `clasificarCompraTarjeta`, `fechasTarjeta`, `fechaPagoDePeriodo`, `resumenTarjeta` (cupo disponible = `max(0, límite − max(0, usado))`) | | `lib/tarjetas.ts:49-128` | `tarjetas.test.ts` |
| Cuotas: `cuotasDeTarjeta` (solo `cuotasTotal ≥ 2` y `cuotaCop > 0`; vence mes a mes), `pagoMensualTarjeta`, `pagoPendienteTarjeta` (abonos aplicados FIFO) | | `lib/cuotasTarjeta.ts:20-89` | `cuotasTarjeta.test.ts` |
| Rendimientos: `tasaDiaria`, `rendimientoDiario`, `rendimientoEstimado` | tasa EA → diaria | `lib/rendimiento.ts` | sí |
| Metas: `progresoDeMeta`, `metasConProgreso` | | `lib/metas.ts` | sí |

### 5.3 4x1000 (GMF)

| Elemento | Valor / regla | Archivo:línea |
|---|---|---|
| `TARIFA_GMF` | `0.004` | `lib/gmf.ts:17` |
| `TOPE_EXENTO_UVT` | 350 UVT/mes | `:20` |
| `UVT_POR_DEFECTO` | `{anio: 2026, pesos: 52_374, fuente: 'Resolución DIAN 000238…'}` | `:42` |
| `TOPE_BAJO_MONTO_UVT` | 65 UVT por cuenta de bajo monto | `:56` |
| `gmfDe(monto)` | `Math.round(|monto| × 0.004)` | `:60` |
| `consumoDelMes(txs, mes, uvt, cuentasCubiertas, {regimen='distribuido', cuentaExentaId, bajoMontoIds, movimientosTransferencia})` | Suma salidas del mes en cuentas cubiertas: tx `gasto` con `cuentaId`, y movs `retiro` cuya nota empieza por `"Enviado a "`. Bajo monto → acumulado por cuenta, grava lo que pase de 65 UVT. Régimen `marcada`: lo que no sale de la cuenta exenta va completo a `sinCupoCop`. `gravado = max(0, base − 350 UVT) + sinCupo + gravadoBajoMonto`; `pctUsado = min(100, round(base/tope·1000)/10)` | `:111-210` |
| Test | `lib/gmf.test.ts` | |

### 5.4 Categorías, presupuestos, recurrentes, agregados

| Función | Regla | Archivo | Test |
|---|---|---|---|
| `hacerCatalogo(personales)` | base (orden de `CATEGORIES`) + propias ordenadas por nombre `'es'`; `lista` excluye archivadas; clave desconocida → apariencia de `otros` con emoji `🏷️` | `categorias.ts:286-301` | `categorias.test.ts` |
| `nuevaClaveCategoria()` / `ES_CLAVE_PROPIA` | `p-<base36 ms>-<contador>-<rand6>`; propia si empieza por `p-` | `categorias.ts:311-316` | sí |
| `sugerirEmojiCategoria`, `sugerirIconoCategoria` | | `categorias.ts:193-203` | sí |
| `gastadoEnCategoria`, `promedioPorPeriodoCategoria` (excluye periodo actual; `round`) | solo `gasto` | `lib/presupuestos.ts:45-89` | `presupuestos.test.ts` |
| `estadoDePresupuesto` | `proyectado = transcurridos==0 ? gastado : round(gastado/transcurridos × días)`; `pctUsado = min(999, round(gastado/tope·1000)/10)`; `disponible = max(0, tope−gastado)`; `excedido = max(0, gastado−tope)` | `presupuestos.ts:91-125` | sí |
| `estadoDeTodos` (orden desc por pct), `tonoDe(estado, umbral=80)` → excedido / atento (va a rebasar o pct ≥ umbral) / bien | | `presupuestos.ts:127-154` | sí |
| `fechaEnMes(r, mes)` (día recortado al último del mes), `yaRegistrado` (mismo mes, kind, categoría y monto exacto), `pendientesDelMes` (fecha ≤ hoy, no registrados; `vencido = fecha < hoy`), `comoTransaccion` (`rawTranscript = "Recurrente: <nombre>"`), `totalMensual`, `detectarSuscripciones`, `proximosRecurrentes` | | `lib/recurrentes.ts:41-242` | `recurrentes.test.ts` |
| `forMonth`, `forPeriod`, `monthTotals` (`tasaAhorro = round((ing−gas)/ing·1000)/10`, null si ing=0; transferencias no cuentan), `byCategory` (orden total desc, empate por clave), `monthsPresent` | | `lib/aggregate.ts:21-84` | `aggregate.test.ts` |
| `filtrarMovimientos`, `resumirFiltrado` | | `lib/filtros.ts` | sí |
| `ultimosMeses`, `serieMensual`, `compararCategorias`, `compararRangos`, `promedioMensual` | | `lib/tendencias.ts` | sí |
| `resumenDelMes`, `esResumenMesHabilitado`, `diaDesbloqueoResumen`, `textoParaCompartir` | resumen tipo "wrapped" | `lib/resumenMes.ts` | sí |
| Contactos: `normalizarNombre`, `parecido`, `UMBRAL_PREGUNTA=0.6`, `partesDelLibro`, `dudasDeUnion`, `balanceConAlias`, `contactoPorApodo` | | `lib/contactos.ts` | sí |

### 5.5 Rachas y forecast

| Función | Regla | Archivo | Test |
|---|---|---|---|
| `calcularRacha(txs, hoy)` | días únicos con movimiento; racha actual cuenta desde hoy o ayer hacia atrás; máxima por días consecutivos; hitos `HITOS_RACHA`; `diasAnotadosMes` | `lib/racha.ts:11-118` | `racha.test.ts` |
| `recordatorioRacha` | notificación local diaria (`tag:'recordatorio-racha'`) | `lib/recordatorioRacha.ts` | sí |
| `construirObligacionesFuturas(entrada, 90)`, `construirEntradasFuturas(entrada, 90)` | | `lib/obligacionesFuturas.ts:26`, `lib/entradasFuturas.ts:7` | **sin test** |
| `proyectarFinanzas(entrada & {hoy, obligaciones, entradasFuturas}, {dias})`, `construirForecast(serie, confianza)` | | `lib/proyeccionFinanciera.ts:39-64` | `proyeccionFinanciera.test.ts`, `proyeccionE2E.test.ts` |
| `construirContextoFinanciero` (motor que alimenta inicio/calendario/asesor) | | `lib/motorFinanciero.ts:98` | `motorFinanciero.test.ts` |
| `eventosDelContexto` | calendario financiero | `lib/calendarioFinanciero.ts:21` | sí |
| Otros con test: `insights`, `senales*`, `inteligenciaFinanciera`, `inteligenciaAvanzada`, `metasInteligentes`, `simuladorFinanciero`, `tributarioColombia` (`analizarTopesRenta`, `calcularRetencionHonorarios`), `vaquitasColombia`, `plantillasGastosColombia`, `integridadFinanciera`, `bandejaRevision` | | `lib/*.ts` | sí (64 archivos `*.test.ts` en `lib/`, `analista/` y `categorias.test.ts`) |

Los `*.test.ts` son la fuente de casos para tests JUnit: portar entradas/salidas literalmente (en especial `formatCop`, `localDate`, `periodo`, `gmf`, `cajitas`, `totalVisible`, `presupuestos`, `recurrentes`, `racha`, `tarjetas`, `cuotasTarjeta`, `aggregate`, `parseTransaction`, `numerals`).

---

## 6. Voz

| Paso | Web (navegador) | WebView Android actual | Kotlin propuesto |
|---|---|---|---|
| Grabación | `MediaRecorder` con primer formato soportado: `audio/webm;codecs=opus`, `audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/ogg;codecs=opus`; máx 60 s — `hooks/useAudioCapture.ts:36-63` | La web detecta `__LUKAPP_AUDIO_NATIVE__` y pide a la app por `postMessage({tipo:'lukapp:audio-nativo', id, accion: inicio\|fin\|cancelar})` — `useAudioCapture.ts:27`. `useGrabacionNativa` usa `expo-audio` `RecordingPresets.HIGH_QUALITY` (AAC/M4A), metering 100 ms (nivel = `(dB+60)/60`), detiene al ir a background, rechaza archivos < 512 bytes, devuelve base64 — `apps/mobile/src/useGrabacionNativa.ts:7-61`. La web lo convierte en `Blob` `audio/mp4` — `useAudioCapture.ts:58-62` | `MediaRecorder` Android: `MPEG_4` + `AAC`, 44.1 kHz mono; mismo límite 60 s y mínimo 512 B; subir como `audio/mp4`. |
| Transcripción | `POST /api/transcribir` con el blob crudo, cabeceras de §4.1, timeout 18 s; si `apiUrl` ≠ relativa y falla, reintenta `/api/transcribir` relativo — `useAudioCapture.ts:172-235` | igual | OkHttp `RequestBody` crudo, timeout 18 s. Manejar `offline:true` → "Escríbelo a mano"; `429 cupo-agotado`. |
| Servidor | Valida JWT, consume cupo `dictado` (`consumir_cupo_plan`), lo devuelve si falla/vacío — `server.ts:4361-4430`. Proveedor único **Groq Whisper `whisper-large-v3`**, multipart `file` (nombre según MIME: mp4/mp3/ogg/wav/webm), `language=es`, `temperature=0`, `response_format=verbose_json`, `prompt` con vocabulario colombiano + términos del usuario (≤30, cabecera ≤6000 car.) — `server_lib/transcripcion.ts:33, 223-320`. `calidad` por `no_speech_prob`/`avg_logprob` (baja ≥0.55 / ≤−1.15; media ≥0.3 / ≤−0.72) | — | Sin cambios de servidor. |
| Interpretación | **Parser local** (no IA): `LukAppApp.tsx:580-585` primero `parseComandoVoz(text, cajitas)` (transferencia / abono / saldo / rendimiento — `lib/parseComandoVoz.ts:7-216`, usa `parseTransferenciaVoz`), si no es comando → `parseMultipleTransactions(text, cuentas, categorias, lexico, historial)` (`lib/parseMultipleTransactions.ts:18`) → `parseTransaction(raw, cuentas, categorias, lexico, historial)` (`lib/parseTransaction.ts:736`, 1538 líneas). Apoyos: `numerals.ts` (`parseAmount`, "20 mil", "luca", palabras), `vocabulary.ts` (frases de tipo, comercios→categoría, métodos de pago), `vocabularioUsuario.ts`, `aprendizaje.ts` (`aprenderDe(txs)` léxico aprendido), `contraparte.ts` | igual (corre en la web) | Portar el parser completo a Kotlin puro (módulo `dominio`) y validar con `parseTransaction.test.ts`, `parseMultipleTransactions.test.ts`, `parseComandoVoz.test.ts`, `parseTransferenciaVoz.test.ts`, `numerals.test.ts`, `vocabulary.test.ts`. Alternativa temporal: no hay endpoint de parseo en servidor (el atajo `/api/atajo/movimiento` usa `server_lib/atajos.ts`, no el parser completo). |
| Confirmación | `ConfirmSheet` / `MultiCapturaModal` / `ConfirmarComandoVoz` antes de guardar; se guarda `rawTranscript` | | Misma UX: nada se guarda sin confirmar. |

OCR de imágenes: `hooks/useImageOCR.ts` + `analizarTextoOCR` (`analista/leerImportacion.ts:303`) y reparseo con `parseTransaction` (`components/Captura.tsx:194-226`).

---

## 7. Notificaciones, archivos y compartir

| Tema | Implementación actual | Archivo | Kotlin |
|---|---|---|---|
| Push | Web Push (VAPID `VITE_VAPID_PUBLIC_KEY`): suscripción guardada en `suscripciones_push(user_id, endpoint, suscripcion jsonb)`; el SW muestra `{titulo, mensaje, etiqueta, url}` | `lib/notificacionesPush.ts:1-36`, `public/sw.js:49-68`, `migrations/20260925170000_suscripciones_push.sql` | **No existe emisor en el servidor** (no hay `web-push` en `server.ts`; `VAPID_PRIVATE_KEY` solo en `.env.example`). Para Android: FCM requeriría tabla/columna nueva y un emisor → cambio de backend. Fase 1: notificaciones locales. |
| Recordatorio de racha | Notificación local diaria a la hora `finanzas:recordatorio-racha:hora` | `lib/recordatorioRacha.ts`, `data/usePreferencias.ts:24-25` | WorkManager/AlarmManager + `NotificationCompat`. |
| Respaldo JSON | `armarRespaldo(datos, generado)` → `{version: 1, generado, datos: Instantanea}`; `leerRespaldo(texto)` valida; `nombreDeArchivo(hoy)` = `finanzas-YYYY-MM-DD.json`; restaurar = `aplicarCambios({reemplazar})` | `lib/respaldo.ts:14-131`, `components/PanelRespaldo.tsx`, `useAlmacen.ts:1267` | Mismo formato JSON (camelCase del modelo TS) para que un respaldo sea intercambiable web↔Android. |
| CSV | `aCsv` separado por `;`, columnas Fecha;Tipo;Monto;Categoría;Descripción;Cuenta;Afecta saldo, monto sin formato, escape de `"`, `,`, `;`, salto | `lib/respaldo.ts:142-163` | Idéntico. |
| Excel | `generarExcelFinanciero` produce **XML SpreadsheetML** (.xls), `descargarExcel` nombre `finanzas-<mes\|etiqueta>.xls` o `finanzas-completo.xls` | `lib/exportarExcel.ts:9-175` | Generar el mismo XML (o Apache POI) y compartir con `FileProvider`. |
| Importación | CSV y `.xlsx` (`leerArchivoTabular`, `analizarFilas`, `fechaImportada`, `montoImportado`), PDF vía `/api/analizar-extracto` (plantillas Bancolombia, Davivienda, Nequi, Nu en `server_lib/plantillas/`), dedupe `planearImportacion`/`claveDeMovimiento` | `analista/leerImportacion.ts:9-303`, `analista/aMovimientos.ts:49-72` | SAF (`ACTION_OPEN_DOCUMENT`), PDF en base64 al servidor. |
| Descargas en el WebView actual | Puente: intercepta `URL.createObjectURL` + click de `<a>`, manda base64 y la app escribe en caché y abre `Sharing.shareAsync` | `apps/mobile/src/App.tsx:93-130, 248-269` | Reemplazado por `FileProvider` + `Intent.ACTION_SEND`. |
| Compartir | `navigator.share` (polyfill nativo `lukapp:compartir` → `Share`) en resumen del mes (`textoParaCompartir`), división de cuentas, invitación a espacio compartido, asesor | `App.tsx:94-112`; `components/ResumenWrapped.tsx:287-290`, `DivisionCuentasModal.tsx:78`, `EspaciosCompartidosView.tsx:107`, `AsesorView.tsx:504` | `Intent.createChooser(ACTION_SEND)`. Invitación: token de `crear_invitacion_compartida`. |

---

## 8. Riesgos y pendientes detectados

1. **Contraseña inconsistente**: `AppNativa.tsx` usa mínimo 8 sin checklist; la web y el servidor usan 6 + mayúscula + minúscula + especial (`src/lib/seguridad.ts`).
2. **OAuth implícito**: la web depende de tokens en el fragmento; en Kotlin conviene PKCE (comprobar que Supabase lo acepte con `lukapp://auth/callback` en la lista de redirecciones).
3. **Push sin backend**: no hay emisor; FCM implica migración nueva.
4. **Parser de voz** (~3.000 líneas entre `parseTransaction`, `numerals`, `vocabulary`) es el mayor esfuerzo de port; sus tests son la red de seguridad.
5. **Render dormido**: replicar precalentamiento `/api/salud` al recuperar sesión.
6. `obligacionesFuturas.ts` y `entradasFuturas.ts` no tienen tests: escribirlos antes de portar.
7. La RPC exige columnas exactas en snake_case y rechaza campos desconocidos: los DTO Kotlin deben serializar exactamente los campos de `desde*()` en `repositorioSupabase.ts:372-675`.
