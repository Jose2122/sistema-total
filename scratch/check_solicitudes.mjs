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
console.log("Using key from .env.local starting with:", key ? key.substring(0, 15) : 'undefined');
const supabase = createClient(env.VITE_SUPABASE_URL, key);

async function run() {
  console.log("Fetching first 10 solicitudes_fondos from .env.local database...");
  const { data, error } = await supabase
    .from('solicitudes_fondos')
    .select('*')
    .limit(10);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Count found:", data.length);
  for (const sol of data) {
    console.log(`ID: ${sol.id} | Codigo: ${sol.codigo_control} | total_bs: ${sol.total_bs} | total_usd: ${sol.total_usd}`);
  }
}
run();
