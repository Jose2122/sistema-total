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
  try {
    // Search for any solicitudes where codigo_control has '29' or similar
    const { data: sols, error: errSols } = await supabase
      .from('solicitudes_fondos')
      .select('id, codigo_control, created_at, responsable_nombre, estado')
      .ilike('codigo_control', '%29%')
      .limit(10);
      
    if (errSols) throw errSols;
    
    console.log('=== SOLICITUDES MATCHING 29 ===');
    console.dir(sols, { depth: null });
    
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
