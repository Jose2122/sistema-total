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

const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(env.VITE_SUPABASE_URL, key);

async function run() {
  try {
    const { data: users, error } = await supabase.from('perfiles')
      .select('id, nombre, apellido, rol, departamento, gerente_directo_nombre, gerente_directo_id')
      .limit(100);
    
    if (error) throw error;
    console.log("Total users found:", users?.length);
    console.log("Users list:");
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
