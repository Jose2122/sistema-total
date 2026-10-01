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

async function testFullFetch() {
  // Let's test insert without ID and with numeric ID and string ID
  const test1 = { razon_social: 'TEST 1', rif: 'J-11111111-1' };
  const res1 = await supabase.from('proveedores').insert([test1]).select();
  console.log("Insert without ID:", res1);

  const test2 = { id: 999999, razon_social: 'TEST 2', rif: 'J-22222222-2' };
  const res2 = await supabase.from('proveedores').insert([test2]).select();
  console.log("Insert with int ID:", res2);

  const test3 = { id: 'PROV-9999', razon_social: 'TEST 3', rif: 'J-33333333-3' };
  const res3 = await supabase.from('proveedores').insert([test3]).select();
  console.log("Insert with string ID:", res3);
}

testFullFetch();


