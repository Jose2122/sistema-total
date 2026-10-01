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

async function inspectSchema() {
  const { data: bCols } = await supabase.from('bancos').select('*').limit(1);
  console.log("bancos columns:", bCols);

  const { data: rCols } = await supabase.from('requisiciones').select('correlativo_req, items').limit(1);
  console.log("requisiciones columns:", rCols);

  // Check if there are other tables:
  const candidateTables = [
    'maestros_centros_costo', 'maestros_clasificaciones', 'maestros_sub_clasificaciones',
    'cat_gerencias', 'cat_cargos', 'partidas_fondos', 'tickets_directos', 'solicitudes_fondos',
    'facturas', 'almacen_movimientos', 'items_inventario'
  ];

  for (const t of candidateTables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(`Table '${t}' is accessible. Columns:`, data && data[0] ? Object.keys(data[0]) : 'empty table');
    }
  }
}

inspectSchema();
