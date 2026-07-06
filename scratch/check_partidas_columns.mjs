import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually
const envPath = path.resolve('.env');
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
  try {
    const { data: d1, error: e1 } = await supabase
      .from('partidas_fondos')
      .select('codigo_ticket')
      .limit(1);

    if (e1) {
      console.log("Error selecting codigo_ticket:", e1.message);
    } else {
      console.log("codigo_ticket exists! Data:", d1);
    }

    const { data: d2, error: e2 } = await supabase
      .from('partidas_fondos')
      .select('codigo_ref')
      .limit(1);

    if (e2) {
      console.log("Error selecting codigo_ref:", e2.message);
    } else {
      console.log("codigo_ref exists! Data:", d2);
    }
  } catch (e) {
    console.error("Exception:", e.message);
  }
}

run();
