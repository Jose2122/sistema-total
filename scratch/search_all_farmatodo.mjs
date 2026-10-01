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

async function searchAllFarmatodo() {
  let allReqs = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('requisiciones')
      .select('id, correlativo_req, items, created_at')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    allReqs = allReqs.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  console.log(`Total Requisiciones cargadas: ${allReqs.length}`);
  const farmaHits = [];

  allReqs.forEach(r => {
    const items = Array.isArray(r.items) ? r.items : [];
    items.forEach((it, idx) => {
      // 1. En item fields
      if (it.proveedor_sugerido && it.proveedor_sugerido.toLowerCase().includes('farmatodo')) {
        farmaHits.push({ type: 'item.proveedor_sugerido', req: r.correlativo_req, it });
      }
      if (it.proveedor_seleccionado && it.proveedor_seleccionado.toLowerCase().includes('farmatodo')) {
        farmaHits.push({ type: 'item.proveedor_seleccionado', req: r.correlativo_req, it });
      }
      // 2. En cotizaciones
      const cots = Array.isArray(it.cotizaciones) ? it.cotizaciones : [];
      cots.forEach(c => {
        const nom = (c.proveedor || c.proveedor_nombre || '').toLowerCase();
        if (nom.includes('farmatodo')) {
          farmaHits.push({ type: 'cotizacion', req: r.correlativo_req, c });
        }
      });
      // 3. En historial_compras
      const hists = Array.isArray(it.historial_compras) ? it.historial_compras : [];
      hists.forEach(h => {
        const nom = (h.proveedor_nombre || '').toLowerCase();
        if (nom.includes('farmatodo')) {
          farmaHits.push({ type: 'historial_compras', req: r.correlativo_req, h });
        }
      });
    });
  });

  console.log(`Total hits de Farmatodo encontrados: ${farmaHits.length}`);
  farmaHits.forEach((hit, i) => {
    console.log(`\n--- Hit #${i+1} [${hit.type}] en Req ${hit.req} ---`);
    console.log(JSON.stringify(hit, null, 2));
  });
}

searchAllFarmatodo();
