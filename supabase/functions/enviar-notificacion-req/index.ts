import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Paleta de colores ajustada: Textos más oscuros, bordes sobrios
const COLORES = {
  fondo_oscuro: '#1f2937', // Gris pizarra elegante
  texto_header: '#ffffff',
  accento: '#f97316',      // Solo para el borde lateral del título
  fondo_body: '#ffffff',
  texto_main: '#1f2937',   // Casi negro para máxima legibilidad
  texto_secundario: '#4b5563', // Gris más oscuro que antes
  fondo_resumen: '#f9fafb',
  borde: '#e5e7eb',
  borde_nota: '#d1d5db',   // Gris sólido para la justificación
  fondo_nota: '#f3f4f6',   // Gris tenue para la justificación
  fondo_boton: '#111827',  // Botón negro para sobriedad
};

serve(async (req) => {
  try {
    const body = await req.json();
    const datos = body.record || body; 

    // Generar renglones con diseño sobrio
    const filasItems = datos.items?.map((item: any) => `
      <tr style="border-bottom: 1px solid ${COLORES.borde};">
        <td style="padding: 12px; color: ${COLORES.texto_main}; text-align: center; font-weight: bold; font-size: 14px;">${item.cant || '0'}</td>
        <td style="padding: 12px; color: ${COLORES.texto_main}; font-size: 14px;">${item.descripcion || 'Sin descripción'}</td>
      </tr>
    `).join('') || `<tr><td colspan="2" style="padding: 20px; text-align: center; color: ${COLORES.texto_secundario}; font-size: 14px;">No hay artículos registrados</td></tr>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'StockSmart <onboarding@resend.dev>',
        to: ['jcontrerasbriceno@gmail.com'], 
        subject: `⚠️ [${datos.prioridad || 'Media'}] Requisición: ${datos.solicitante}`,
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
                <p style="color: #94a3b8; margin: 0; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;">Control Interno | StockSmart</p>
              </div>

              <div style="padding: 35px 30px;">
                <h2 style="color: ${COLORES.texto_main}; font-size: 19px; margin: 0 0 20px 0; border-left: 4px solid ${COLORES.accento}; padding-left: 15px; font-weight: 700;">Nueva Requisición de Materiales</h2>
                
                <div style="background-color: ${COLORES.fondo_resumen}; border-radius: 8px; padding: 20px; border: 1px solid ${COLORES.borde}; margin-bottom: 20px;">
                  <table style="width: 100%; font-size: 14px; border-collapse: collapse; color: ${COLORES.texto_main};">
                    <tr><td style="padding: 6px 0; color: ${COLORES.texto_secundario};">👤 SOLICITANTE:</td><td style="text-align: right; font-weight: bold;">${datos.solicitante}</td></tr>
                    <tr><td style="padding: 6px 0; color: ${COLORES.texto_secundario};">🏢 GERENCIA:</td><td style="text-align: right; font-weight: bold;">${datos.gerencia || 'Operaciones'}</td></tr>
                    <tr><td style="padding: 6px 0; color: ${COLORES.texto_secundario};">📍 C. COSTO:</td><td style="text-align: right; font-weight: bold;">${datos.centro_costo}</td></tr>
                    <tr><td style="padding: 6px 0; color: ${COLORES.texto_secundario};">📅 FECHA REQ:</td><td style="text-align: right; font-weight: bold; color: ${COLORES.texto_main};">${datos.fecha_requerida || 'Pendiente'}</td></tr>
                    <tr><td style="padding: 6px 0; color: ${COLORES.texto_secundario};">🚩 PRIORIDAD:</td><td style="text-align: right; font-weight: bold; color: ${datos.prioridad === 'Alta' ? '#dc2626' : '#0284c7'};">${datos.prioridad || 'Normal'}</td></tr>
                  </table>
                </div>

                <div style="margin-bottom: 25px; padding: 15px; border-radius: 8px; background-color: ${COLORES.fondo_nota}; border: 1px solid ${COLORES.borde_nota};">
                  <h3 style="margin: 0 0 8px 0; font-size: 13px; color: ${COLORES.texto_main}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Motivo / Justificación:</h3>
                  <p style="margin: 0; font-size: 14px; color: ${COLORES.texto_main}; line-height: 1.5; font-style: italic;">
                    "${datos.justificacion || 'No se proporcionó una justificación para esta solicitud.'}"
                  </p>
                </div>

                <h3 style="margin: 0 0 12px 0; font-size: 15px; color: ${COLORES.texto_main}; font-weight: 600;">Detalle de Materiales:</h3>
                <div style="border: 1px solid ${COLORES.borde}; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                      <tr style="background-color: #f9fafb;">
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid ${COLORES.borde}; color: ${COLORES.texto_secundario}; width: 20%; font-weight: 600;">CANT.</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid ${COLORES.borde}; color: ${COLORES.texto_secundario}; font-weight: 600;">DESCRIPCIÓN</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filasItems}
                    </tbody>
                  </table>
                </div>

                <div style="text-align: center;">
                  <a href="http://localhost:5173/dashboard" 
                     style="background-color: ${COLORES.fondo_boton}; color: white; padding: 16px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px; letter-spacing: 0.5px;">
                    REVISAR EN STOCKSMART
                  </a>
                </div>
              </div>

              <div style="background-color: #f8fafc; padding: 25px; text-align: center; border-top: 1px solid ${COLORES.borde};">
                <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Estimación y Control Interno | Total Clean C.A.</p>
                <p style="margin: 5px 0 0 0; color: #cbd5e1; font-size: 10px;">© 2026 Sistema StockSmart Enterprise</p>
              </div>
            </div>
          </div>
          </body>
          </html>
        `,
      }),
    });

    const result = await res.json();
    return new Response(JSON.stringify(result), { status: 200 });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
})