import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

let envPath = path.resolve('.env.local');
if (!fs.existsSync(envPath)) {
  envPath = path.resolve('.env');
}
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

async function run() {
  console.log("=== COUNTING ALL RECORDS ===");

  const tables = [
    'maestros_centros_costo',
    'maestros_clasificaciones',
    'maestros_sub_clasificaciones',
    'solicitudes_fondos',
    'partidas_fondos',
    'requisiciones',
    'tickets_directos',
    'proveedores'
  ];

  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Table '${table}' error: ${error.message}`);
    } else {
      console.log(`Table '${table}' count: ${count}`);
    }
  }
}

run();
