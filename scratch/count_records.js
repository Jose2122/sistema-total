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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("=== COUNTING MASTER DATA RECORDS ===");

  const { count: ccc, error: e1 } = await supabase.from('maestros_centros_costo').select('*', { count: 'exact', head: true });
  const { count: clc, error: e2 } = await supabase.from('maestros_clasificaciones').select('*', { count: 'exact', head: true });
  const { count: scc, error: e3 } = await supabase.from('maestros_sub_clasificaciones').select('*', { count: 'exact', head: true });

  if (e1 || e2 || e3) {
    console.error("Errors:", { e1, e2, e3 });
  } else {
    console.log(`maestros_centros_costo count: ${ccc}`);
    console.log(`maestros_clasificaciones count: ${clc}`);
    console.log(`maestros_sub_clasificaciones count: ${scc}`);
  }
}

run();
