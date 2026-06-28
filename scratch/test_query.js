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

async function testQuery() {
  try {
    const { data, error } = await supabase
      .from('maestros_sub_clasificaciones')
      .select('*, maestros_clasificaciones(nombre, centro_costo_id, maestros_centros_costo!centro_costo_id(nombre))')
      .limit(3);

    if (error) {
      console.error('Query Error:', error);
    } else {
      console.log('Query Success! Sample results:');
      console.dir(data, { depth: null });
    }
  } catch (err) {
    console.error('Catch Error:', err);
  }
}

testQuery();
