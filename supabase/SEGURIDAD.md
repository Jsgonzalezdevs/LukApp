# Activación obligatoria en Supabase

El código valida las contraseñas en los flujos de LukApp y el servidor nunca
acepta una elevación directa a superadmin. Pero el registro público de Supabase
también es una API: para que nadie pueda saltarse la validación del navegador,
activa estos controles en **Authentication → Password Security** antes de
desplegar:

1. Longitud mínima: **12**.
2. Exigir **minúscula, mayúscula, número y símbolo**.
3. Activa la protección contra contraseñas filtradas si tu plan la ofrece.
4. Exige reautenticación reciente para cambiar contraseña.

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
