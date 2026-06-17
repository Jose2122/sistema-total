import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const columns = ['solicitud_ref', 'clasificacion_admin', 'centro_costo', 'departamento', 'codigo_control'];
  for (const col of columns) {
    const { data, error } = await supabase.from('tickets_directos').select(col).limit(1);
    if (error) {
      console.log(`Column ${col}: ERROR -> ${error.message}`);
    } else {
      console.log(`Column ${col}: SUCCESS`);
    }
  }
}
test();
