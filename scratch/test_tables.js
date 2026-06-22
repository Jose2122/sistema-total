import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const candidateTables = [
  'almacen', 'almacen_recepcion', 'compras', 'items', 'items_comprados',
  'trazabilidad_compras', 'trazabilidad', 'inventario', 'requisiciones',
  'requisicion_logs', 'partidas_fondos', 'solicitudes_fondos'
];

async function check() {
  for (const table of candidateTables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`Table '${table}' -> Error: ${error.message} (${error.code})`);
      } else {
        console.log(`Table '${table}' -> EXISTS (rows: ${data.length})`);
        if (data.length > 0) {
          console.log(`  Columns:`, Object.keys(data[0]));
        }
      }
    } catch (e) {
      console.log(`Table '${table}' -> Fatal: ${e.message}`);
    }
  }
}
check();
