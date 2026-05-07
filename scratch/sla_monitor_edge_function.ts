import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Buscar requisiciones Normales que vencen en menos de 24 horas (Día 4-5)
  // O que tengan 4 días de aprobadas y no ejecutadas.
  const { data: pendientes, error } = await supabase
    .from('requisiciones')
    .select('*')
    .eq('prioridad', 'Normal')
    .eq('status_compra', 'En espera')
    .eq('is_pausada', false)
    .filter('fecha_limite_compra', 'lte', new Date(Date.now() + 86400000).toISOString()) // Vence en < 24h
    .filter('fecha_limite_compra', 'gt', new Date().toISOString());

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  for (const req of pendientes) {
    // Enviar correo vía Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Alertas SITC <alertas@totalclean.com>',
        to: ['compras@totalclean.com'], 
        cc: ['gerencia@totalclean.com'],
        subject: `⚠️ ALERTA SLA: Requisición ${req.correlativo_req} por vencer`,
        html: `
          <h1>Alerta de Tiempo de Compra</h1>
          <p>La requisición <b>${req.correlativo_req}</b> de <b>${req.solicitante}</b> está por vencer su plazo de 5 días hábiles.</p>
          <p>Prioridad: ${req.prioridad}</p>
          <p>Fecha Límite: ${new Date(req.fecha_limite_compra).toLocaleDateString()}</p>
          <hr>
          <a href="https://sitc-compras.vercel.app/compras">Ir al Módulo de Compras</a>
        `
      })
    });
  }

  return new Response(JSON.stringify({ processed: pendientes.length }), { status: 200 });
});
