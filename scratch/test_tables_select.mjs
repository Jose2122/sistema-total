import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '').replace('\r', '');
    env[k] = v;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testAllTables() {
  const tables = ['requisiciones', 'solicitudes_fondos', 'perfiles', 'proveedores'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    console.log(`Select ${t}:`, error ? error.message : `OK (${data.length} rows)`);
  }
}

testAllTables();
