import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let envUrl = '', envKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(envUrl, envKey);

async function checkTables() {
  const tables = [
    'requisiciones',
    'tickets_pago',
    'tickets_directos',
    'tickets_express',
    'tickets',
    'ordenes_compra',
    'solicitudes_fondos',
    'requisicion_logs',
    'logs_actividad',
    'user_auth_logs',
    'system_errors'
  ];

  for (const t of tables) {
    try {
      const { count, error, data } = await supabase.from(t).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`Table '${t}': Error -> ${error.message} (${error.code})`);
      } else {
        console.log(`Table '${t}': EXISTS with ${count} rows.`);
      }
    } catch (e) {
      console.log(`Table '${t}': exception -> ${e.message}`);
    }
  }
}

checkTables();
