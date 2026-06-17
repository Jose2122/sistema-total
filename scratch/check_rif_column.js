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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Checking 'aplica_rif' in 'requisiciones'...");
  const { data: d1, error: e1 } = await supabase.from('requisiciones').select('aplica_rif').limit(1);
  if (e1) {
    console.log("Error selecting from requisiciones:", e1.message);
  } else {
    console.log("Successfully selected 'aplica_rif' from requisiciones:", d1);
  }

  console.log("Checking 'aplica_rif' in 'tickets_directos'...");
  const { data: d2, error: e2 } = await supabase.from('tickets_directos').select('aplica_rif').limit(1);
  if (e2) {
    console.log("Error selecting from tickets_directos:", e2.message);
  } else {
    console.log("Successfully selected 'aplica_rif' from tickets_directos:", d2);
  }
}
run();
