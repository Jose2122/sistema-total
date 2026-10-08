import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let envUrl = '', envKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(envUrl, envKey);

async function checkAllPossibleTables() {
  const candidateTables = [
    'requisiciones',
    'requisicion_logs',
    'tickets_directos',
    'solicitudes_fondos',
    'ordenes_compra',
    'odc',
    'perfiles',
    'system_errors',
    'user_auth_logs',
    'logs_actividad',
    'notificaciones',
    'proveedores',
    'bancos',
    'maestros_centros_costo',
    'maestros_clasificaciones',
    'partidas_fondos',
    'presupuesto_compras',
    'tickets',
    'solicitudes'
  ];

  for (const t of candidateTables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (!error) {
      console.log(`✓ Table '${t}': ${count} rows`);
    } else {
      console.log(`✗ Table '${t}': ${error.message}`);
    }
  }
}

checkAllPossibleTables();
