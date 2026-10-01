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

async function findFarmatodo() {
  console.log("=== BUSCANDO FARMATODO EN SUPABASE ===");
  
  // 1. En tabla proveedores
  const { data: provs, error: pErr } = await supabase
    .from('proveedores')
    .select('*')
    .ilike('razon_social', '%farmatodo%');
  
  console.log("En tabla proveedores:", provs, pErr);

  // 2. En requisiciones
  const { data: reqs, error: rErr } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, items')
    .limit(1000);

  const matchedItems = [];
  if (reqs) {
    reqs.forEach(r => {
      const items = Array.isArray(r.items) ? r.items : [];
      items.forEach(it => {
        const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
        hist.forEach(h => {
          const nom = (h.proveedor_nombre || '').toLowerCase();
          if (nom.includes('farmatodo') || nom.includes('farma')) {
            matchedItems.push({
              reqId: r.id,
              reqCorrelativo: r.correlativo_req,
              proveedor_nombre: h.proveedor_nombre,
              proveedor_id: h.proveedor_id,
              proveedor_rif: h.proveedor_rif,
              h
            });
          }
        });
      });
    });
  }

  console.log(`\nEncontradas ${matchedItems.length} compras de Farmatodo en requisiciones:`);
  console.log(matchedItems);
}

findFarmatodo();
