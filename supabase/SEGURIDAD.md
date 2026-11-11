# Activación obligatoria en Supabase

El código valida las contraseñas en los flujos de LukApp y el servidor nunca
acepta una elevación directa a superadmin. Pero el registro público de Supabase
también es una API, así que conviene que Supabase pida al menos lo mismo.

Las reglas de contraseña no tienen menú propio: están dentro del proveedor
**Email**, en **Authentication → Sign In / Providers → Email** (en algunas
versiones del panel el menú se llama solo **Providers**):

1. **Minimum password length**: **6** (es el valor por defecto de Supabase).
2. **Password requirements**: **No required characters**. Supabase no
   ofrece la combinación «minúscula, mayúscula y símbolo» sin exigir número, y
   LukApp ya la valida en el navegador y en el servidor. Si escoges una opción
   con dígitos, las claves sin número que LukApp acepta fallarán al registrarse.
3. La protección contra contraseñas filtradas (**Prevent use of leaked
   passwords**) solo aparece en el plan Pro o superior.
4. **Secure password change**: actívalo para exigir reautenticación reciente
   al cambiar la contraseña.

## Entrar con Google

1. En Google Cloud → **Google Auth Platform**: completa **Branding** (nombre
   LukApp, logo, correo de soporte), en **Audience** deja el tipo *External* y
   publícala en producción (en modo prueba solo entran los correos que
   agregues como testers), y en **Data access** deja `openid`, `email` y
   `profile`.
2. En **Clients → Create client**, tipo **Web application**:
   - *Authorized JavaScript origins*: `https://lukapp.app`,
     `https://mi.lukapp.app` (y `http://localhost:5173` mientras pruebas).
   - *Authorized redirect URIs*: la *Callback URL* que muestra Supabase en el
     paso 3 (`https://<tu-proyecto>.supabase.co/auth/v1/callback`).
3. En Supabase → **Authentication → Sign In / Providers → Google**: actívalo,
   pega el *Client ID* y el *Client Secret* y guarda.
4. En Supabase → **Authentication → URL Configuration**, en *Redirect URLs*
   agrega:
   - `https://mi.lukapp.app/app`
   - `https://lukapp.app/app`
   - `lukapp://auth/callback` (la app Android)
   - `http://localhost:5173/app` (desarrollo)

Las cuentas nuevas que entran con Google no tienen apodo; el trigger
`crear_perfil` las crea con `usuario` vacío.

Después aplica la migración
`supabase/migrations/20260923140241_aprobaciones_superadmin.sql` en el SQL
Editor. Crea `solicitudes_superadmin` con RLS sin acceso desde el navegador y
una función transaccional que sólo puede ejecutar la llave de servicio.

## Operación

Al crear o editar una cuenta como **Superadmin**, LukApp la deja inicialmente
como usuario normal y crea una solicitud. Sólo un *segundo* superadmin, que no
sea ni quien la solicitó ni la persona a elevar, puede aprobarla desde
Superadmin → Usuarios. Si hoy sólo existe un superadmin, no hay excepción
automática: debe conservarse la solicitud pendiente hasta que un administrador
adicional y confiable pueda revisarla.
