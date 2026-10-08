import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '').replace('\r', '');
    env[k] = v;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testAlmacenLoad() {
  let reqs = [];
  let page = 0;
  let keep = true;
  while (keep) {
    const { data: chunk, error } = await supabase
      .from('requisiciones')
      .select('*')
      .eq('estado_aprobacion', 'aprobado_final')
      .order('fecha_emision', { ascending: false })
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) return console.error(error);
    if (chunk && chunk.length > 0) {
      reqs = reqs.concat(chunk);
      if (chunk.length < 1000) keep = false;
      else page++;
    } else {
      keep = false;
    }
  }

  console.log('Total reqs loaded:', reqs.length);
  const found594 = reqs.find(r => r.id === 594);
  console.log('Found 594:', !!found594, found594?.correlativo_req, found594?.solicitante);
}

testAlmacenLoad();
