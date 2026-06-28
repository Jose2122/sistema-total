import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const tables = [
    'abonos',
    'liquidacion_abonos',
    'compras_abonos',
    'facturas_abonos',
    'requisiciones_abonos',
    'requisiciones_facturas_abonos',
    'liquidacion_facturas',
    'abonos_facturas',
    'requisicion_abonos',
    'requisicion_facturas_abonos'
  ];

  console.log("Testing connection...");
  const testConnection = await supabase.from('requisiciones').select('id').limit(1);
  if (testConnection.error) {
    console.error("Connection error:", testConnection.error);
    return;
  }
  console.log("Connection OK.");

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table "${table}": ${error.message} (code: ${error.code})`);
    } else {
      console.log(`Table "${table}": EXISTS! Columns:`, data.length > 0 ? Object.keys(data[0]) : 'empty table');
    }
  }
}
run();
