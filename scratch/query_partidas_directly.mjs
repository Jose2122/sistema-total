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

const key = env.VITE_SUPABASE_ANON_KEY;
console.log("Using URL:", env.VITE_SUPABASE_URL);
const supabase = createClient(env.VITE_SUPABASE_URL, key);

async function run() {
  console.log("Searching partidas_fondos directly for pu_bs = 80850...");
  const { data, error } = await supabase
    .from('partidas_fondos')
    .select('*')
    .eq('pu_bs', 80850);

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  console.log(`Found ${data.length} matches:`);
  data.forEach((p, idx) => {
    console.log(`[Row ${idx+1}] ID: ${p.id} | Solicitud ID: ${p.solicitud_id} | Desc: ${p.descripcion} | Cant: ${p.cantidad} | PU Bs: ${p.pu_bs} | PU USD: ${p.pu_usd} | Status: ${p.status} | Ticket: ${p.codigo_ticket} | Requisicion: ${p.requisicion_id} | Creador: ${p.emisor_nombre}`);
  });
}
run();
