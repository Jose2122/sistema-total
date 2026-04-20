import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('ADMIN_SERVICE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // 1. Cliente con privilegio de Service Role (para acciones de administración)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 2. Cliente para validar al usuario que llama (con su propio JWT)
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // 3. Validar Rol (Solo Admin o Gerente General)
    const { data: perfil, error: perfilError } = await adminClient
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    const rol = perfil?.rol?.toLowerCase() || ''
    const esAdmin = rol === 'admin' || rol === 'gerente general' || user.email === 'jcontreras.totalclean@gmail.com'

    if (perfilError || !esAdmin) {
      return new Response(JSON.stringify({ error: 'Permisos insuficientes para realizar esta acción' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 4. Procesar Acción
    const { action, data } = await req.json()

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
        return new Response(JSON.stringify({ message: 'Contraseña actualizada' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      case 'delete_user': {
        const { id } = data
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(id)
        if (deleteError) throw deleteError
        return new Response(JSON.stringify({ message: 'Usuario eliminado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Acción no reconocida' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
    }

  } catch (error) {
    console.error('Error en Edge Function:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
