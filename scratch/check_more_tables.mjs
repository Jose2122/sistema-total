import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    val = val.replace(/^['"]|['"]$/g, '').trim();
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const tables = [
    'requisiciones',
    'ordenes_compra',
    'ordenes_compra_items',
    'proveedores',
    'bancos',
    'presupuesto_compras',
    'tickets_directos',
    'solicitudes_fondos',
    'compras_retenciones',
    'cuentas_por_pagar'
  ];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('id').limit(1);
    if (error) {
      console.log(`${t}: ERROR -> ${error.message}`);
    } else {
      console.log(`${t}: EXISTS (count: ${data ? data.length : 0})`);
    }
  }
}

check();
