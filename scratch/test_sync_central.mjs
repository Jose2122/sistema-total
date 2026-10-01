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

async function syncCentralDirectory() {
  const { data: rec, error } = await supabase
    .from('requisiciones')
    .select('id, items')
    .eq('correlativo_req', 'SYS-PROVEEDORES-CENTRAL')
    .single();

  console.log("Found central record:", rec?.id, error);
  if (rec && rec.items) {
    const items = Array.isArray(rec.items) ? rec.items : JSON.parse(rec.items);
    console.log("Central directory items count:", items[0]?.proveedores?.length);
    console.log("Sample proveedores:", items[0]?.proveedores?.map(p => `${p.razon_social} (${p.rif})`));
  }
}

syncCentralDirectory();
