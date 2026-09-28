import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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

const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(env.VITE_SUPABASE_URL, serviceKey);

async function run() {
  console.log("Using service key:", !!env.VITE_SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('proveedores')
    .select('id, razon_social, rif, persona_contacto')
    .order('razon_social', { ascending: true });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Total proveedores en DB: ${data.length}`);
  const sinRif = data.filter(p => !p.rif || p.rif.trim() === '' || p.rif.toUpperCase() === 'N/A');
  console.log(`Proveedores sin RIF o con N/A (${sinRif.length}):`);
  sinRif.forEach(p => {
    console.log(`ID: ${p.id} | Razon Social: ${p.razon_social} | RIF: ${p.rif}`);
  });
}

run();
