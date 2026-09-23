import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("=== QUERYING ACTIVIDADES DOMINGO 13 DE SEPTIEMBRE (2026-09-13) ===");
  console.log("Using URL:", supabaseUrl);
  console.log("Service Key active:", !!serviceKey);

  // 1. Table ordenes_compra
  const { data: odc, error: odcErr } = await supabase
    .from('ordenes_compra')
    .select('*')
    .order('created_at', { ascending: false });

  console.log("\n--- TOTAL ODCs EN DB ---:", odc ? odc.length : odcErr?.message);
  if (odc) {
    console.log("Muestras de ODCs (últimas 10):");
    odc.slice(0, 10).forEach(o => {
      console.log(`ID: ${o.id} | Nro: ${o.numero_orden || o.codigo_control || o.correlativo} | Status: ${o.estado || o.status} | Created: ${o.created_at} | Updated: ${o.updated_at} | Solicitante/Prov: ${o.proveedor_nombre || o.proveedor || o.usuario_creador}`);
    });

    const odcDom13 = odc.filter(o => {
      const c = o.created_at || '';
      const u = o.updated_at || '';
      return c.includes('2026-09-13') || u.includes('2026-09-13') || c.includes('2026-09-14') || u.includes('2026-09-14');
    });
    console.log(`\nODCs creadas/modificadas el 13-14 de Septiembre (${odcDom13.length}):`);
    console.log(JSON.stringify(odcDom13, null, 2));
  }

  // 2. Table requisiciones
  const { data: reqs, error: reqErr } = await supabase
    .from('requisiciones')
    .select('*')
    .order('created_at', { ascending: false });

  console.log("\n--- TOTAL REQUISICIONES EN DB ---:", reqs ? reqs.length : reqErr?.message);
  if (reqs) {
    const reqDom13 = reqs.filter(r => {
      const c = r.created_at || '';
      const u = r.updated_at || '';
      return c.includes('2026-09-13') || u.includes('2026-09-13');
    });
    console.log(`Requisiciones del Domingo 13 (${reqDom13.length}):`);
    console.log(JSON.stringify(reqDom13, null, 2));
  }

  // 3. Table solicitudes_fondos
  const { data: sfs, error: sfErr } = await supabase
    .from('solicitudes_fondos')
    .select('*')
    .order('created_at', { ascending: false });

  console.log("\n--- TOTAL SOLICITUDES DE FONDOS EN DB ---:", sfs ? sfs.length : sfErr?.message);
  if (sfs) {
    const sfDom13 = sfs.filter(s => {
      const c = s.created_at || '';
      const u = s.updated_at || '';
      return c.includes('2026-09-13') || u.includes('2026-09-13');
    });
    console.log(`Solicitudes de fondos del Domingo 13 (${sfDom13.length}):`);
    console.log(JSON.stringify(sfDom13, null, 2));
  }

  // 4. Table tickets_directos
  const { data: tkts, error: tktErr } = await supabase
    .from('tickets_directos')
    .select('*')
    .order('created_at', { ascending: false });

  console.log("\n--- TOTAL TICKETS DIRECTOS EN DB ---:", tkts ? tkts.length : tktErr?.message);
  if (tkts) {
    const tkDom13 = tkts.filter(t => {
      const c = t.created_at || '';
      const u = t.updated_at || '';
      return c.includes('2026-09-13') || u.includes('2026-09-13');
    });
    console.log(`Tickets directos del Domingo 13 (${tkDom13.length}):`);
    console.log(JSON.stringify(tkDom13, null, 2));
  }

  // 5. Table notificaciones
  const { data: notifs, error: notifErr } = await supabase
    .from('notificaciones')
    .select('*')
    .order('created_at', { ascending: false });

  console.log("\n--- TOTAL NOTIFICACIONES EN DB ---:", notifs ? notifs.length : notifErr?.message);
  if (notifs) {
    const notifDom13 = notifs.filter(n => {
      const c = n.created_at || '';
      return c.includes('2026-09-13');
    });
    console.log(`Notificaciones del Domingo 13 (${notifDom13.length}):`);
    console.log(JSON.stringify(notifDom13, null, 2));
  }
}

run();
