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

## Acceso con Google

El botón ya vive en LukApp; para que Google acepte el flujo hay que conectar una
aplicación OAuth al proyecto una sola vez:

1. En **Google Auth Platform → Clients**, crea un cliente de tipo **Web
   application**. Agrega el origen público de LukApp y, para desarrollo,
   `http://localhost:5173` en **Authorized JavaScript origins**.
2. En **Authorized redirect URIs**, agrega la URL de callback que muestra
   **Supabase → Authentication → Sign In / Providers → Google**. Tiene esta
   forma: `https://<proyecto>.supabase.co/auth/v1/callback`.
3. En esa pantalla de Google dentro de Supabase, activa el proveedor y guarda
   el **Client ID** y el **Client Secret**. El secreto se guarda en Supabase;
   nunca va en una variable `VITE_` ni en este repositorio.
4. En **Supabase → Authentication → URL Configuration**, deja como **Site URL**
   el dominio público y permite tanto `https://<dominio>/app` como
   `http://localhost:5173/app` entre las Redirect URLs.

LukApp llama `signInWithOAuth({ provider: 'google' })` y vuelve a `/app`. El
trigger `crear_perfil` admite este alta aunque Google no mande un apodo: crea el
perfil con su correo y deja el nombre opcional para completarlo luego.
