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
  const { data: reqs, error: rErr } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, solicitante')
    .ilike('correlativo_req', '%0060%');
  console.log("Req matching 0060:", reqs, rErr);

  const { data: odc1, error: oErr } = await supabase
    .from('ordenes_compra')
    .select('id, numero_odc, requisicion_id, proveedor_nombre')
    .ilike('numero_odc', '%000001%');
  console.log("ODC-000001:", odc1, oErr);
}

check();
