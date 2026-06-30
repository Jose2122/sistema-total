import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Interceptor global para registrar automáticamente errores de API de Supabase
const customFetch = async (url, options) => {
  try {
    const response = await fetch(url, options);
    
    // Evitar bucle infinito y filtrar errores de API (4xx o 5xx)
    const urlString = typeof url === 'string' ? url : url?.url || '';
    if (!urlString.includes('/system_errors') && !response.ok && response.status >= 400) {
      logSupabaseError(urlString, response.status, response.statusText || 'Error de API');
    }
    
    return response;
  } catch (err) {
    const urlString = typeof url === 'string' ? url : url?.url || '';
    if (!urlString.includes('/system_errors')) {
      logSupabaseError(urlString, 0, err.message || 'Error de conexión / red');
    }
    throw err;
  }
};

const logSupabaseError = async (url, status, statusText) => {
  try {
    const endpoint = url.split('/rest/v1/')[1] || url;
    
    let userId = null;
    try {
      const keys = Object.keys(localStorage);
      const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      if (authKey) {
        const session = JSON.parse(localStorage.getItem(authKey));
        userId = session?.user?.id || null;
      }
    } catch (e) {
      console.warn("No se pudo obtener el usuario para el log de error:", e);
    }

    // Inserción directa mediante fetch para no gatillar el interceptor de manera recursiva
    await fetch(`${supabaseUrl}/rest/v1/system_errors`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        componente: `Supabase API: ${endpoint.substring(0, 150)}`,
        error_mensaje: `HTTP ${status}: ${statusText}`.substring(0, 500),
        status_code: status,
        usuario_id: userId,
        usuario_rol: 'Anon'
      })
    });
  } catch (err) {
    console.error("Error al registrar logs en system_errors:", err);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: customFetch
  }
})