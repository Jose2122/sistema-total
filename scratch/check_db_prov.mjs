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

async function check() {
  const { data: pDb, error: err1 } = await supabase.from('proveedores').select('*').ilike('razon_social', '%TECHNOLOGY%');
  console.log('Query ilike TECHNOLOGY en tabla proveedores:', pDb, 'error:', err1);

  const { data: pDbRif, error: errRif } = await supabase.from('proveedores').select('*').eq('rif', 'J-40282085-2');
  console.log('Query RIF J-40282085-2 en tabla proveedores:', pDbRif, 'error:', errRif);
}
check();
