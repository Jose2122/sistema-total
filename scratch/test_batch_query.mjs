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

async function test() {
  console.log("Fetching first few solicitudes to get IDs...");
  // Let's login first as tostitomas using password 123456
  // Wait, if it fails, we will try anon
  const { data: sols } = await supabase.from('solicitudes_fondos').select('id').limit(5);
  
  const ids = (sols || []).map(s => s.id);
  console.log("IDs found:", ids);
  
  console.log("Running the partidas_fondos select query...");
  const { data, error } = await supabase
    .from('partidas_fondos')
    .select('solicitud_id, pu_bs, pu_usd, cantidad, pago_realizado, status, requisicion_id, ticket_id, codigo_ticket, descripcion, requisiciones(id, items, status_compra, estado_aprobacion)')
    .in('solicitud_id', ids.length > 0 ? ids : ['7d5bb720-6991-43de-a3e2-acb09dc52bd7']) // dummy uuid if none found
    .limit(5000);

  if (error) {
    console.error("Query failed with error code:", error.code);
    console.error("Error message:", error.message);
    console.error("Error details:", error.details);
  } else {
    console.log("Query succeeded! Data count:", data.length);
  }
}
test();
