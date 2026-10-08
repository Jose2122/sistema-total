import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let envUrl = '', envKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(envUrl, envKey);

async function inspectDates() {
  console.log('--- REQUISICION_LOGS ---');
  const { data: logs } = await supabase.from('requisicion_logs').select('*').limit(5);
  console.log(logs);

  console.log('\n--- TICKETS_DIRECTOS ---');
  const { data: tkts } = await supabase.from('tickets_directos').select('*').limit(5);
  console.log(tkts);

  console.log('\n--- ORDENES_COMPRA ---');
  const { data: odcs } = await supabase.from('ordenes_compra').select('*').limit(5);
  console.log(odcs);

  // Let's also check if there are tickets in other tables or how tickets are stored in ModuloTicketsPago
  console.log('\n--- PARTIDAS_FONDOS / SOLICITUDES_FONDOS ---');
  const { data: sf } = await supabase.from('solicitudes_fondos').select('*').limit(5);
  console.log(sf);
}

inspectDates();
