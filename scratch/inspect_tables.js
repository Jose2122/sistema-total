import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env or .env.local manually
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
  const tables = ['solicitudes_fondos', 'partidas_fondos', 'requisiciones', 'auditoria_renglones'];
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`Table ${table} error or does not exist:`, error.message);
      } else {
        console.log(`Table ${table} exists! Columns:`, data.length > 0 ? Object.keys(data[0]) : 'No rows, but table exists');
        if (data.length > 0) {
          console.log(`Sample row from ${table}:`, JSON.stringify(data[0], null, 2));
        }
      }
    } catch (err) {
      console.error(`Error with table ${table}:`, err);
    }
  }
}

run();
