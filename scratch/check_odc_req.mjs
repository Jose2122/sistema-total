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
  const { data: req303 } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, solicitante, gerencia, centro_costo, obra')
    .eq('id', 303);
  console.log("Req 303:", req303);

  const { data: odcs } = await supabase
    .from('ordenes_compra')
    .select('id, numero_odc, requisicion_id, proveedor_nombre, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log("Recent ODCs:", odcs);
}

check();
