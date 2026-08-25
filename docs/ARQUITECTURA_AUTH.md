# Arquitectura de Autenticación y Autorización

## Resumen Ejecutivo

El sistema de autenticación es **de dos capas**:
1. **Frontend (UI):** Determina qué opciones mostrar
2. **Backend (BD):** Valida de verdad qué puede hacer cada usuario

El backend SIEMPRE es la fuente de verdad.

---

## Flujo de Autenticación

```
Usuario entra a la app
    ↓
¿Tiene Supabase configurado? 
    ├─ NO → Modo "local" (sin login, IndexedDB)
    └─ SÍ → Solicitar sesión a Supabase
        ↓
    ¿Usuario autenticado?
        ├─ NO → Mostrar LandingLukApp + LoginPanel
        └─ SÍ → Cargar rol desde BD
            ↓
        fetch perfiles(user.id)
            ├─ Consulta exitosa → usar rol de BD
            ├─ Falla de red → SIEMPRE rol='usuario' (fail-close)
            │   └─ Reintentar hasta 3 veces con backoff exponencial
            └─ Timeout → rol='usuario'
                ↓
            Mostrar opciones según rol
```

---

## Tabla de Permisos

| Usuario | Puede ver... | Puede hacer... |
|---------|-------------|-----------------|
| Anónimo | Landing page, login | Crear cuenta (si registro público habilitado) |
| Usuario regular | /finanzas | Ver/editar sus transacciones, ajustes personales |
| Admin | /finanzas + /superadmin + /estadisticas | Todo, incluyendo gestionar usuarios |

---

## Roles en Base de Datos

### Tabla `perfiles` (Supabase)

```sql
CREATE TABLE perfiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  usuario text UNIQUE,
  rol text NOT NULL DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario')),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Función `es_admin()`

```sql
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = (SELECT auth.uid()) AND rol = 'admin'
  );
$$;
```

**Importante:** Esta función usa `SECURITY DEFINER` para evitar loops de RLS.

---

## Row Level Security (RLS)

Todas las tablas tienen RLS habilitado:

```sql
-- Solo el usuario ve sus propios datos
CREATE POLICY lectura_privada ON perfiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR public.es_admin());

-- Solo los admins pueden escribir
-- (No hay política = nadie desde el frontend puede escribir)
```

El servidor (Render, con `service_role_key`) se salta RLS para operaciones administrativas.

---

## Frontend vs Backend

### ¿Qué valida el frontend?

✅ **Validación de UX (qué mostrar):**
- ¿Mostrar botón de Superadmin?
- ¿Mostrar panel de Ecosistema?
- ¿Mostrar opción de logout?

```typescript
const esAdminOStaff = useMemo(
  () => rol === 'admin' || permisos.length > 0,
  [rol, permisos]
);
```

### ¿Qué valida el backend?

✅ **Validación de seguridad (qué permitir):**
- GET /api/usuarios → validar es_admin() en BD
- POST /api/usuarios → validar es_admin() en BD
- DELETE /api/usuario/:id → validar es_admin() + validar no es último admin

```typescript
// server_lib/auth.ts
export const motivoParaRechazar = (cambios, ctx): string | null => {
  if (esSuPropiaCuenta && quitaAdmin) {
    return 'No puedes quitarte a ti mismo el rol de administrador.';
  }
  // ... más validaciones
};
```

---

## Cómo Cargar el Rol

En `src/apps-dashboard/AppsRoot.tsx`:

1. **Si no autenticado:** rol = 'usuario', permisos = []
2. **Si autenticado:** Consultar `perfiles` en Supabase
3. **Si consulta falla:** Reintentar hasta 3 veces, luego rol = 'usuario'

```typescript
const cargarRol = async (intentos = 0) => {
  if (sesion.estado.modo !== 'autenticado') {
    setRol('usuario');
    setPermisos([]);
    return;
  }

  try {
    const cliente = obtenerSupabase();
    const { data: { user } } = await cliente.auth.getUser();
    
    if (user) {
      const { data: perfil } = await cliente
        .from('perfiles')
        .select('rol, roles_personalizados(nombre, permisos)')
        .eq('id', user.id)
        .maybeSingle();
      
      // Usar perfil.rol como fuente de verdad
      setRol(perfil?.rol === 'admin' ? 'admin' : 'usuario');
      setPermisos(/* ... */);
    }
  } catch (error) {
    if (intentos < 3) {
      // Reintentar con backoff exponencial
      setTimeout(() => cargarRol(intentos + 1), Math.min(1000 * 2^intentos, 10000));
      return;
    }
    
    // Después de 3 intentos: fail-close
    setRol('usuario');
    setPermisos([]);
  }
};
```

---

## Errores Comunes (Y cómo evitarlos)

### ❌ Hardcodear emails de admin

```typescript
// MAL: Visible en git history para siempre
if (email === 'admin@example.com') {
  setRol('admin');
}
```

✅ **Correcto:** Usar la BD

```typescript
// BIEN: La BD es la fuente de verdad
if (perfil?.rol === 'admin') {
  setRol('admin');
}
```

---

### ❌ Fail-open en error handling

```typescript
// MAL: Si BD falla → admin automático
catch {
  if (email === 'admin@example.com') {
    setRol('admin');  // ⚠️ Escalada de privilegios
  }
}
```

✅ **Correcto:** Fail-close

```typescript
// BIEN: Si BD falla → usuario normal, con reintentos
catch (error) {
  if (intentos < MAX_INTENTOS) {
    // Reintentar
  } else {
    setRol('usuario');  // ✅ Seguro por defecto
  }
}
```

---

### ❌ Confiar solo en frontend

```typescript
// MAL: El frontend no puede autenticarse a sí mismo
const esAdmin = () => window.localStorage.getItem('admin') === 'true';
```

✅ **Correcto:** Frontend solo para UX, backend para seguridad

```typescript
// BIEN: Frontend muestra opciones, backend valida
// Frontend:
if (rol === 'admin') {
  mostrarBotanSuperadmin();
}

// Backend:
app.get('/api/superadmin/usuarios', (req, res) => {
  if (!esAdminEnBD(req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // ... retornar usuarios
});
```

---

## Ciclo de Vida de Admin Impersonation

```typescript
// 1. Admin hace clic en "Asesorar a usuario"
localStorage.setItem('__admin_session_backup__', JSON.stringify({
  access_token: currentSession.access_token,
  refresh_token: currentSession.refresh_token,
  usuario: currentUser.usuario,
  email: currentUser.email
}));

// 2. El app muestra banner: "Modo asesoría — viendo como usuario X"
// 3. Admin puede usar la app como ese usuario (ve sus datos)
// 4. Admin hace clic en "Volver a mi cuenta"
const backup = JSON.parse(localStorage.getItem('__admin_session_backup__'));
await cliente.auth.setSession({
  access_token: backup.access_token,
  refresh_token: backup.refresh_token
});

// 5. Session restaurada, volvemos a admin
```

---

## Testing de Seguridad

Casos a validar:

1. ✅ Usuario regular no puede ver /superadmin
2. ✅ Si BD falla, usuario regular sigue siendo usuario (no se vuelve admin)
3. ✅ Admin impersonado ve datos del usuario, no los suyos
4. ✅ No se puede quitar el último admin
5. ✅ Password reset funciona sin estar autenticado

Ver `src/apps-dashboard/AppsRoot.tsx` para tests.

---

## Despliegue (Render + Vercel)

### Supabase (BD)
- Llaves públicas van a `.env` (prefijo `VITE_`)
- `SUPABASE_SERVICE_ROLE_KEY` SOLO en Render, nunca en Vercel

### Vercel (Frontend)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` apunta a Render

### Render (API)
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`, etc.

**Validación:** Si ves una variable empezando con `VITE_` en Render, ¡está mal! Eso va en Vercel.

---

## Checklist de Seguridad

- [ ] Ningún email de admin hardcodeado en código
- [ ] catch blocks siempre retornan rol='usuario'
- [ ] Dependency arrays no contienen objetos enteros
- [ ] RLS habilitado en todas las tablas
- [ ] Función es_admin() existe y usa SECURITY DEFINER
- [ ] /api/superadmin/* valida permisos server-side
- [ ] No hay console.log() de secretos
- [ ] .env.example no contiene valores reales
- [ ] Prueba impersonation y logout
- [ ] Prueba que usuarios normales no ven /superadmin

---

**Última actualización:** 25 Aug 2026  
**Mantenedor:** Sistema de autenticación centralizado
