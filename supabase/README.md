# Supabase — Finanzas

La app funciona sin esto. Sin variables configuradas se queda en **modo local**:
guarda en IndexedDB del dispositivo y no pide login. Configurar Supabase añade
cuenta y sincronización entre celular y computador.

## Pasos

1. Crea un proyecto en [supabase.com](https://supabase.com).

2. Corre la migración. En el panel de Supabase: **SQL Editor → New query**, pega
   todo el contenido de [`migrations/0001_finanzas.sql`](migrations/0001_finanzas.sql)
   y ejecútalo. Crea las cuatro tablas y activa Row Level Security.

3. Copia las credenciales desde **Project Settings → API** a tu `.env` local
   (y a las variables de entorno de Netlify para producción):

   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

   Solo la clave **anon**. La `service_role` se salta RLS por completo y no debe
   salir nunca de un servidor.

4. Reinicia el servidor de desarrollo. Vite lee las variables al arrancar, así
   que un `.env` nuevo no se recoge en caliente.

## Verificar que RLS quedó bien

Esto es lo único que impide que una cuenta lea la de otra, así que vale la pena
comprobarlo. En **SQL Editor**:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('transacciones', 'cajitas', 'cajita_movimientos', 'metas');
```

Las cuatro deben salir con `rowsecurity = true`.

## Confirmación de correo

Por defecto Supabase exige confirmar el correo antes del primer ingreso. Si es
solo para ti y quieres saltarte ese paso: **Authentication → Providers → Email →
Confirm email**, desactívalo.

## Recuperar o cambiar contraseña

La pantalla de acceso incluye **¿Olvidaste tu contraseña?**. El enlace que
recibe el usuario vuelve a la misma aplicación y permite definir una contraseña
nueva; no hace falta desplegar una página adicional.

En Supabase ve a **Authentication → URL Configuration** y agrega, reemplazando
el dominio por el de producción:

```
https://TU-DOMINIO/ecosistema
```

Configura también un proveedor SMTP en **Authentication → SMTP Settings**. El
servicio de prueba de Supabase tiene límites reducidos y no debe usarse como
canal de recuperación en producción.

## Correos con identidad LukApp

Las plantillas listas para el envío están en [`templates/`](templates/):

- `confirmacion.html`: **Confirm signup** — asunto sugerido: `Confirma tu correo en LukApp`.
- `recuperacion.html`: **Reset password** — asunto sugerido: `Restablece tu contraseña de LukApp`.

Para un proyecto alojado en Supabase, abre **Authentication → Email Templates**
y pega el contenido completo de cada archivo en su flujo correspondiente. El
proveedor que entrega el mensaje puede seguir siendo Resend, configurado como
SMTP en **Authentication → SMTP Settings**; las plantillas se administran en
Supabase porque es quien genera los enlaces de autenticación.

Ambas usan `{{ .ConfirmationURL }}`, la variable oficial de Supabase que
conserva el destino configurado por la aplicación (incluido `/ecosistema` para
la recuperación). No sustituyas esa variable por una URL fija. En Resend deja
desactivado el seguimiento de clics para estos mensajes de autenticación: si
reescribe el enlace, la verificación puede fallar.

Los usuarios con sesión activa pueden cambiar su propia contraseña desde
Finanzas. Como alternativa de soporte, Superadmin puede establecer una
contraseña temporal desde la lista de usuarios. Para esa última opción el
servidor necesita, además de las variables públicas, esta variable privada:

```
SUPABASE_SERVICE_ROLE_KEY=...
```

Nunca la declares con prefijo `VITE_` ni la incluyas en el bundle del navegador.
