import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Circuit breaker para evitar tormentas de escritura en system_errors durante caídas de BD
let lastErrorLogTime = 0;
let circuitBreakerOpenUntil = 0;
const ERROR_LOG_COOLDOWN_MS = 60000; // Máximo 1 log por minuto por cliente
const CIRCUIT_BREAKER_PAUSE_MS = 300000; // 5 minutos de pausa si hay error 5xx / red / timeout

// Interceptor global con protección contra cascada de fallos (Disk IO protection)
const customFetch = async (url, options) => {
  try {
    const response = await fetch(url, options);
    
    const urlString = typeof url === 'string' ? url : url?.url || '';
    // Si la BD o Gateway arroja 5xx o 429 (Too Many Requests), abrir el circuit breaker y NO escribir en BD
    if (response.status >= 500 || response.status === 429) {
      circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_PAUSE_MS;
      return response;
    }

    // Evitar bucle infinito: no loguear errores de system_errors, auth ni realtime
    if (
      !urlString.includes('/system_errors') &&
      !urlString.includes('/auth/v1/') &&
      !urlString.includes('/realtime/v1/') &&
      !response.ok &&
      response.status >= 400 &&
      response.status < 500
    ) {
      logSupabaseError(urlString, response.status, response.statusText || 'Error de API');
    }
    
    return response;
  } catch (err) {
    // Error de red / timeout: abrir circuit breaker para NO disparar escrituras adicionales
    circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_PAUSE_MS;
    throw err;
  }
};

const logSupabaseError = async (url, status, statusText) => {
  const now = Date.now();
  if (now < circuitBreakerOpenUntil || (now - lastErrorLogTime) < ERROR_LOG_COOLDOWN_MS) {
    return;
  }
  lastErrorLogTime = now;

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
    const res = await fetch(`${supabaseUrl}/rest/v1/system_errors`, {
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
    if (!res.ok) {
      circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_PAUSE_MS;
    }
  } catch {
    circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_PAUSE_MS;
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: customFetch
  },
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
})