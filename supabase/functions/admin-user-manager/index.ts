import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('ADMIN_SERVICE_KEY') || Deno.env.get('admin_service_key') || '';

    console.log('--- Inicia Proceso admin-user-manager ---');
    if (!supabaseServiceKey) console.error('ADVERTENCIA: No se encontró la clave de servicio (SUPABASE_SERVICE_ROLE_KEY ni ADMIN_SERVICE_KEY) en las variables de entorno.');

    // 1. Cliente Admin (usando específicamente la clave de administración manual)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 2. Validar al usuario que llama (con su propio JWT)
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? ''
    console.log('Cabecera Authorization recibida:', authHeader ? `${authHeader.substring(0, 20)}...` : '(vacía)');

    if (!authHeader) {
      console.error('No se recibió cabecera de autorización');
      return new Response(JSON.stringify({ error: 'No autorizado: Falta cabecera de autorización' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !user) {
      console.error('Error de autenticación JWT:', authError?.message);
      return new Response(JSON.stringify({ 
        error: 'No autorizado: Sesión inválida', 
        details: authError?.message || 'Usuario no encontrado en la sesión',
        header_received: authHeader ? 'SÍ' : 'NO'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    console.log('Usuario solicitante:', user.email);

    // 3. Validar Rol (Solo Admin o Gerente General o usuarios autorizados)
    const { data: perfil, error: perfilError } = await adminClient
      .from('perfiles')
      .select('rol, departamento, capacidades')
      .eq('id', user.id)
      .maybeSingle()

    const rol = perfil?.rol?.toLowerCase() || ''
    const emailLower = user.email?.toLowerCase() || ''
    const capacidades = perfil?.capacidades || {}
    
    // Lista de correos maestros (SIEMPRE tienen acceso)
    const esMasterEmail = emailLower === 'jcontreras.totalclean@gmail.com' || 
                          emailLower === 'cvega@totalclean.com.ve' ||
                          emailLower === 'karincmm1@gmail.com';
    
    const esAdmin = rol === 'admin' || rol === 'gerente general' || esMasterEmail;
    const tienePrivilegioClave = (capacidades as Record<string, any>)?.puede_cambiar_contrasenas === true;

    console.log('Validación:', { rol, esAdmin, esMasterEmail, tienePrivilegioClave });

    // Procesar Acción
    const body = await req.json();
    const { action, data } = body;
    console.log('Acción solicitada:', action);

    // --- ACCIÓN QUE BYPASSEA RLS PARA USUARIOS DE DEPARTAMENTO ---
    if (action === 'get_department_users') {
      const userDepto = perfil?.departamento || '';
      const deptoUpper = userDepto.trim().toUpperCase();
      const emailLowerSolicitante = user.email?.toLowerCase() || '';
      
      // REGLA DE VISIBILIDAD TOTAL
      const tieneAccesoTotal = emailLowerSolicitante === 'jcontreras.totalclean@gmail.com' || 
                               emailLowerSolicitante === 'cvega@totalclean.com.ve' || 
                               emailLowerSolicitante === 'karincmm1@gmail.com' ||
                               deptoUpper.includes('ADMINISTRACIÓN');

      console.log(`[GET_DEPT_USERS] Requerido por email: ${emailLowerSolicitante}, depto: ${userDepto}`);

      let query = adminClient.from('perfiles').select('*');
      
      if (!tieneAccesoTotal) {
        if (deptoUpper === 'SEGURIDAD' || deptoUpper === 'SIAHO' || deptoUpper === 'SHA') {
          query = query.or(`departamento.ilike.%Seguridad%,departamento.ilike.%SIAHO%,departamento.ilike.%SHA%`);
        } else {
          query = query.ilike('departamento', `%${userDepto.trim()}%`);
        }
      }

      const { data: users, error: fetchError } = await query.order('apellido');
      if (fetchError) throw fetchError;

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // --- ACCIONES RESTRINGIDAS A ADMINS/PRIVILEGIADOS ---
    const actionRequiresFullAdmin = ['create_user', 'delete_user'].includes(action);
    const actionRequiresPasswordPrivilege = ['update_password'].includes(action);
    
    let isAuthorized = false;
    if (actionRequiresFullAdmin && esAdmin) {
      isAuthorized = true;
    } else if (actionRequiresPasswordPrivilege && (esAdmin || tienePrivilegioClave)) {
      isAuthorized = true;
    }
    
    if (!isAuthorized) {
      console.error('Permiso denegado para:', emailLower);
      return new Response(JSON.stringify({ error: 'Permisos insuficientes para realizar esta acción' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    switch (action) {
      case 'create_user': {
        const { email, password, user_metadata } = data
        const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password: password || '123456',
          email_confirm: true,
          user_metadata
        })
        if (createError) throw createError
        console.log('Usuario creado exitosamente en Auth');
        return new Response(JSON.stringify({ user: authData.user }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      case 'update_password': {
        const { id, password } = data
        const { error: updateError } = await adminClient.auth.admin.updateUserById(id, {
          password: password
        })
        if (updateError) throw updateError
        console.log('Contraseña actualizada vía Admin');
        return new Response(JSON.stringify({ message: 'Contraseña actualizada' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      case 'delete_user': {
        const { id } = data
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(id)
        if (deleteError) throw deleteError
        console.log('Usuario eliminado vía Admin');
        return new Response(JSON.stringify({ message: 'Usuario eliminado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      default:
        console.error(`Acción no reconocida: "${action}"`);
        return new Response(JSON.stringify({ 
          error: `Acción "${action}" no reconocida en esta versión de la función.`,
          received_action: action,
          detail: 'Asegúrate de que la función esté desplegada con la versión más reciente.' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
    }

  } catch (error) {
    console.error('ERROR FATAL EN EDGE FUNCTION:', error.message)
    return new Response(JSON.stringify({ error: error.message, detail: 'Revisa los logs del dashboard para más info' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
