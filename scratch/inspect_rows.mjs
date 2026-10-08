import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let envUrl = '', envKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(envUrl, envKey);

async function checkRows() {
  const tables = [
    'requisiciones',
    'tickets_pago',
    'solicitudes_fondos',
    'ordenes_compra',
    'tickets_directos',
    'requisicion_logs'
  ];

  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(5);
    if (error) {
      console.log(`Table '${t}': Error -> ${error.message}`);
    } else {
      console.log(`Table '${t}': Returned ${data.length} sample rows. Sample keys:`, Object.keys(data[0] || {}));
      const { count } = await supabase.from(t).select('*', { count: 'exact' });
      console.log(`  -> Exact count: ${count}`);
    }
  }
}

checkRows();
