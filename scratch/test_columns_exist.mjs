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

const key = env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(env.VITE_SUPABASE_URL, key);

async function run() {
  try {
    console.log("Checking columns by querying them...");
    
    const { data: d1, error: err1 } = await supabase
      .from('perfiles')
      .select('gerente_directo_nombre')
      .limit(1);
      
    if (err1) {
      console.log("Column 'gerente_directo_nombre' status: ERROR ->", err1.message, err1.code);
    } else {
      console.log("Column 'gerente_directo_nombre' status: EXISTS (No error)");
    }

    const { data: d2, error: err2 } = await supabase
      .from('perfiles')
      .select('gerente_directo_id')
      .limit(1);
      
    if (err2) {
      console.log("Column 'gerente_directo_id' status: ERROR ->", err2.message, err2.code);
    } else {
      console.log("Column 'gerente_directo_id' status: EXISTS (No error)");
    }
  } catch (e) {
    console.error("Fatal error:", e);
  }
}
run();
