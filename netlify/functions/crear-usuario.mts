import { createClient } from '@supabase/supabase-js';


export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Verificar que quien llama sea el admin mediante un token seguro.
  // En un entorno de producción, esto debería usar el JWT de Supabase Auth
  // y verificar que el rol en public.perfiles sea 'admin'.
  // Por ahora usaremos la misma estrategia de _lib/auth.ts (un secreto de admin)
  // o verificaremos el JWT del usuario de Supabase.
  
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Configuración incompleta del servidor (falta Service Role Key)' }),
      { status: 500 }
    );
  }

  // Cliente con permisos totales para poder crear usuarios saltándose RLS
  const adminAuthClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { email, password, usuario, rol } = await req.json();

    // 1. Validar que el usuario que hace la petición realmente es un admin de supabase
    // Obtenemos el usuario que hace la petición
    const { data: adminUser, error: adminError } = await adminAuthClient.auth.getUser(token);
    
    if (adminError || !adminUser.user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401 });
    }

    // Comprobar rol en la tabla perfiles
    const { data: adminProfile } = await adminAuthClient
      .from('perfiles')
      .select('rol')
      .eq('id', adminUser.user.id)
      .single();

    if (adminProfile?.rol !== 'admin') {
      return new Response(JSON.stringify({ error: 'No tienes permisos de administrador' }), { status: 403 });
    }

    // 2. Crear el nuevo usuario
    const { data: newUser, error: createError } = await adminAuthClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        usuario: usuario || ''
      }
    });

    if (createError) throw createError;

    // 3. Si el rol es admin, actualizar la tabla perfiles (ya que el trigger lo crea como 'usuario' por defecto)
    if (rol === 'admin' && newUser.user) {
      const { error: updateError } = await adminAuthClient
        .from('perfiles')
        .update({ rol: 'admin' })
        .eq('id', newUser.user.id);
        
      if (updateError) throw updateError;
    }

    return new Response(JSON.stringify({ success: true, user: newUser.user }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
