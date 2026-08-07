import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const COLORES = {
  fondo_oscuro: '#1f2937', // Gris pizarra elegante
  texto_header: '#ffffff',
  accento: '#f97316',      // Borde lateral naranja corporativo
  fondo_body: '#ffffff',
  texto_main: '#1f2937',   // Casi negro para legibilidad
  texto_secundario: '#4b5563', // Gris oscuro
  fondo_resumen: '#f9fafb',
  borde: '#e5e7eb',
  borde_nota: '#d1d5db',   // Gris sólido para justificación
  fondo_nota: '#f3f4f6',   // Gris tenue para justificación
  fondo_boton: '#111827',  // Botón negro para sobriedad
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Manejo de peticiones preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const datos = body.record || body;

    // Obtener y estructurar destinatarios dinámicos
    let destinatarios: string[] = [];
    const inputTo = body.to || datos.to;

    if (inputTo) {
      if (Array.isArray(inputTo)) {
        destinatarios = inputTo
          .map((email: any) => String(email).trim())
          .filter((email: string) => email.length > 0);
      } else if (typeof inputTo === 'string') {
        destinatarios = inputTo
          .split(',')
          .map((email: string) => email.trim())
          .filter((email: string) => email.length > 0);
      }
    }

    // Destinatario de prueba por defecto si no se especifican dinámicos
    if (destinatarios.length === 0) {
      destinatarios = ['jcontreras.totalclean@gmail.com'];
    }

    // Extraer campos del ticket
    const idControl = datos.codigo_control || datos.solicitud_ref || datos.id || 'N/A';
    const solicitante = datos.gerente_nombre || datos.solicitante || 'N/A';
    const gerencia = datos.departamento || datos.gerencia || 'N/A';
    const centroCosto = datos.centro_costo || datos.centroCosto || 'N/A';
    
    // Obtener beneficiario principal (si hay a nivel del ticket o en la primera partida)
    const beneficiario = datos.beneficiario || datos.items?.[0]?.beneficiario || 'N/A';
    
    // Formatear monto total
    let montoTotal = 'N/A';
    if (datos.total_usd !== undefined && datos.total_usd !== null) {
      montoTotal = `$${datos.total_usd}`;
    } else if (datos.total !== undefined && datos.total !== null) {
      montoTotal = `$${datos.total}`;
    } else if (datos.monto_total !== undefined && datos.monto_total !== null) {
      montoTotal = datos.monto_total;
    }

    const metodoPago = datos.clasificacion_admin || datos.metodo_pago || datos.tipo_pago || 'N/A';
    const proyecto = datos.solicitud_ref || datos.proyecto || 'N/A';
    const justificacion = datos.justificacion || datos.concepto || datos.justificacion_detallada || 'No se proporcionó un concepto o justificación para este pago.';

    // Generar renglones de partidas
    const filasItems = datos.items?.map((item: any) => {
      const cant = item.cant || item.cantidad || '1';
      const desc = item.descripcion || item.detalle || 'Sin descripción';
      
      let itemMonto = '0.00';
      if (item.total !== undefined && item.total !== null) {
        itemMonto = String(item.total);
      } else if (item.monto !== undefined && item.monto !== null) {
        itemMonto = String(item.monto);
      } else if (item.pu !== undefined && item.pu !== null) {
        itemMonto = String(item.pu);
      }

      return `
        <tr style="border-bottom: 1px solid ${COLORES.borde};">
          <td style="padding: 12px; color: ${COLORES.texto_main}; text-align: center; font-weight: bold; font-size: 14px;">${cant}</td>
          <td style="padding: 12px; color: ${COLORES.texto_main}; font-size: 14px;">${desc}</td>
          <td style="padding: 12px; color: ${COLORES.texto_main}; text-align: right; font-weight: bold; font-size: 14px;">$${itemMonto}</td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="3" style="padding: 20px; text-align: center; color: ${COLORES.texto_secundario}; font-size: 14px;">No hay partidas registradas en el ticket</td></tr>`;

    // Asunto personalizado
    const subject = `💳 [Nuevo Ticket de Pago] - ID: ${idControl} | Solicitante: ${solicitante}`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'SITC Total Clean <notificaciones@totalclean.com.ve>',
        to: destinatarios,
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
            </style>
          </head>
          <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 20px auto; background-color: ${COLORES.fondo_body}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid ${COLORES.borde};">
              
              <div style="background-color: ${COLORES.fondo_oscuro}; padding: 25px 20px; text-align: center;">
                <h1 style="color: white; font-size: 22px; margin: 0; letter-spacing: 3px; text-transform: uppercase; font-weight: 700;">Total Clean C.A.</h1>
                <div style="border-top: 1px solid rgba(255,255,255,0.1); width: 50px; margin: 12px auto;"></div>
                <p style="color: #94a3b8; margin: 0; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;">Control Interno | SITC</p>
              </div>

              <div style="padding: 35px 30px;">
                <h2 style="color: ${COLORES.texto_main}; font-size: 19px; margin: 0 0 20px 0; border-left: 4px solid ${COLORES.accento}; padding-left: 15px; font-weight: 700;">Registro de Ticket de Pago</h2>
                
                <div style="background-color: ${COLORES.fondo_resumen}; border-radius: 8px; padding: 20px; border: 1px solid ${COLORES.borde}; margin-bottom: 20px;">
                  <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: ${COLORES.texto_main};">
                    <tr><td style="padding: 6px 0; color: ${COLORES.texto_secundario};">👤 SOLICITANTE:</td><td style="text-align: right; font-weight: bold;">${solicitante}</td></tr>
                    <tr><td style="padding: 6px 0; color: ${COLORES.texto_secundario};">🏢 GERENCIA:</td><td style="text-align: right; font-weight: bold;">${gerencia}</td></tr>
                    <tr><td style="padding: 6px 0; color: ${COLORES.texto_secundario};">📍 C. COSTO:</td><td style="text-align: right; font-weight: bold;">${centroCosto}</td></tr>
                    <tr><td style="padding: 6px 0; color: ${COLORES.texto_secundario};">🤝 BENEFICIARIO:</td><td style="text-align: right; font-weight: bold;">${beneficiario}</td></tr>
                    <tr><td style="padding: 6px 0; color: ${COLORES.texto_secundario};">💰 MONTO TOTAL:</td><td style="text-align: right; font-weight: bold; color: ${COLORES.fondo_oscuro}; font-size: 15px;">${montoTotal}</td></tr>
                    <tr><td style="padding: 6px 0; color: ${COLORES.texto_secundario};">💳 MÉTODO DE PAGO:</td><td style="text-align: right; font-weight: bold;">${metodoPago}</td></tr>
                    <tr><td style="padding: 6px 0; color: ${COLORES.texto_secundario};">📁 PROYECTO / REF:</td><td style="text-align: right; font-weight: bold;">${proyecto}</td></tr>
                  </table>
                </div>

                <div style="margin-bottom: 25px; padding: 15px; border-radius: 8px; background-color: ${COLORES.fondo_nota}; border: 1px solid ${COLORES.borde_nota};">
                  <h3 style="margin: 0 0 8px 0; font-size: 13px; color: ${COLORES.texto_main}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Justificación / Concepto:</h3>
                  <p style="margin: 0; font-size: 14px; color: ${COLORES.texto_main}; line-height: 1.5; font-style: italic;">
                    "${justificacion}"
                  </p>
                </div>

                <h3 style="margin: 0 0 12px 0; font-size: 15px; color: ${COLORES.texto_main}; font-weight: 600;">Detalle de Partidas:</h3>
                <div style="border: 1px solid ${COLORES.borde}; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                      <tr style="background-color: #f9fafb;">
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid ${COLORES.borde}; color: ${COLORES.texto_secundario}; width: 15%; font-weight: 600;">CANT.</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid ${COLORES.borde}; color: ${COLORES.texto_secundario}; font-weight: 600;">DESCRIPCIÓN</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid ${COLORES.borde}; color: ${COLORES.texto_secundario}; width: 25%; font-weight: 600;">MONTO</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filasItems}
                    </tbody>
                  </table>
                </div>

                <div style="text-align: center;">
                  <a href="${Deno.env.get('SITE_URL') || 'https://sitc.totalclean.com.ve'}" 
                     style="background-color: ${COLORES.fondo_boton}; color: white; padding: 16px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px; letter-spacing: 0.5px;">
                    VER TICKET EN SITC
                  </a>
                </div>
              </div>

              <div style="background-color: #f8fafc; padding: 25px; text-align: center; border-top: 1px solid ${COLORES.borde};">
                <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Estimación y Control Interno | Total Clean C.A.</p>
                <p style="margin: 5px 0 0 0; color: #cbd5e1; font-size: 10px;">© 2026 Sistema SITC Enterprise</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const result = await res.json();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
