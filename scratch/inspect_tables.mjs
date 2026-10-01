import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '').replace('\r', '');
    env[k] = v;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspectAllTables() {
  console.log("=== INSPECCIONANDO TODAS LAS TABLAS QUE PUEDAN TENER CONTACTOS ===");

  // 1. Requisiciones items sample
  const { data: reqs } = await supabase.from('requisiciones').select('id, items, cotizaciones, datos_adicionales').limit(50);
  if (reqs && reqs.length > 0) {
    console.log(`Requisiciones analizadas: ${reqs.length}`);
    reqs.forEach((r, idx) => {
      if (idx < 5) {
        if (r.cotizaciones) console.log(`Req #${r.id} cotizaciones:`, JSON.stringify(r.cotizaciones).substring(0, 150));
        const items = Array.isArray(r.items) ? r.items : [];
        items.forEach(it => {
          if (it.historial_compras && it.historial_compras.length > 0) {
            console.log(`Req #${r.id} Item historial_compras[0] keys:`, Object.keys(it.historial_compras[0]));
            console.log(`Sample:`, it.historial_compras[0]);
          }
          if (it.proveedor_seleccionado) console.log("Proveedor seleccionado en item:", it.proveedor_seleccionado);
          if (it.proveedores) console.log("Proveedores en item:", it.proveedores);
        });
      }
    });
  }

  // 2. Tickets directos
  const { data: tickets, error: tErr } = await supabase.from('tickets_directos').select('*').limit(10);
  if (!tErr && tickets && tickets.length > 0) {
    console.log(`\nTickets directos encontrados: ${tickets.length}`);
    console.log("Columnas en tickets_directos:", Object.keys(tickets[0]));
    console.log("Muestra de ticket:", {
      beneficiario: tickets[0].beneficiario,
      rif: tickets[0].rif_beneficiario || tickets[0].rif,
      telefono: tickets[0].telefono,
      partidas: tickets[0].partidas
    });
  }

  // 3. Solicitudes de pago / fondos
  const { data: fondos, error: fErr } = await supabase.from('solicitudes_fondos').select('*').limit(10);
  if (!fErr && fondos && fondos.length > 0) {
    console.log(`\nSolicitudes de fondos encontradas: ${fondos.length}`);
    console.log("Columnas en solicitudes_fondos:", Object.keys(fondos[0]));
  }

  // 4. Ordenes de compra
  const { data: ordenes, error: oErr } = await supabase.from('ordenes_compra').select('*').limit(10);
  if (!oErr && ordenes && ordenes.length > 0) {
    console.log(`\nOrdenes de compra encontradas: ${ordenes.length}`);
    console.log("Columnas en ordenes_compra:", Object.keys(ordenes[0]));
    console.log("Muestra orden compra:", {
      proveedor: ordenes[0].proveedor_nombre || ordenes[0].proveedor,
      rif: ordenes[0].proveedor_rif || ordenes[0].rif,
      contacto: ordenes[0].contacto || ordenes[0].persona_contacto,
      telefono: ordenes[0].telefono
    });
  }
}

inspectAllTables();
