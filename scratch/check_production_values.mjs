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
  console.log("Logging in as cvega@totalclean.com...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'cvega@totalclean.com',
    password: '123456'
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }
  console.log("Login success! Querying solicitudes_fondos...");

  const { data, error } = await supabase
    .from('solicitudes_fondos')
    .select('id, codigo_control, total_bs, total_usd, responsable_nombre')
    .eq('codigo_control', 'RRH-SEM 27-26');

  if (error) {
    console.error("Query failed:", error.message);
    return;
  }

  console.log(`Results found: ${data.length}`);
  for (const row of data) {
    console.log(`ID: ${row.id} | Codigo: ${row.codigo_control} | total_bs: ${row.total_bs} | total_usd: ${row.total_usd} | Responsable: ${row.responsable_nombre}`);
  }
}
run();
