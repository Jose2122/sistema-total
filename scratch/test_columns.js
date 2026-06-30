import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

let envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  envPath = path.resolve('.env.local');
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
  // Try querying information_schema.columns
  const { data, error } = await supabase
    .from('columns')
    .select('table_name, column_name, data_type')
    .in('table_name', ['solicitudes_fondos', 'partidas_fondos', 'requisiciones', 'auditoria_renglones']);
  
  if (error) {
    console.log("Could not query information_schema directly:", error.message);
    // Let's try to query it by schema_introspection or executing raw SQL if there's any RPC,
    // or let's try a different way.
  } else {
    console.log("Columns metadata:");
    console.log(data);
  }
}
run();
