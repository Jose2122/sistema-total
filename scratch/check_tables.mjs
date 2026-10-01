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

const candidateTables = [
  'requisiciones', 'proveedores', 'tickets_directos', 'solicitudes_fondos', 
  'ordenes_compra', 'ordenes_compras', 'compras', 'productos', 
  'perfiles', 'bancos', 'atributos', 'cotizaciones', 'contactos_proveedores'
];

async function checkAllCandidateTables() {
  for (const t of candidateTables) {
    try {
      const { data, error, count } = await supabase.from(t).select('*', { count: 'exact', head: false }).limit(2);
      if (error) {
        console.log(`Tabla [${t}]: Error (${error.message || error.code})`);
      } else {
        console.log(`Tabla [${t}]: OK, total registros = ${count ?? (data ? data.length : 0)}`);
        if (data && data.length > 0) {
          console.log(`  -> Columnas:`, Object.keys(data[0]).join(', '));
        }
      }
    } catch (err) {
      console.log(`Tabla [${t}]: Exception (${err.message})`);
    }
  }
}

checkAllCandidateTables();
