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

async function inspectTables() {
  console.log("Testing insert on proveedores...");
  const { data: pData, error: pErr } = await supabase.from('proveedores').insert([{
    razon_social: 'TEST ROCCA',
    rif: 'J-07040810-3'
  }]).select();
  console.log("proveedores insert result:", pData, pErr);

  console.log("\nTesting insert on requisiciones...");
  // Check schema of requisiciones or other tables
  const { data: rCols, error: rErr } = await supabase.from('requisiciones').select('id, items').limit(1);
  console.log("requisiciones sample:", rCols, rErr);

  // Check if there are other tables like proveedores_db, directorio, config, etc.
  const checkList = ['proveedores', 'proveedores_sitc', 'directorio_proveedores', 'contactos', 'perfiles', 'usuarios', 'configuracion'];
  for (const tbl of checkList) {
    const { data, error } = await supabase.from(tbl).select('*').limit(1);
    console.log(`Table ${tbl}:`, error ? error.message : `OK (found ${data?.length} rows)`);
  }
}

inspectTables();
