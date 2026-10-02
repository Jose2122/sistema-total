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

async function searchGeneral() {
  const { data: tickets } = await supabase.from('tickets_directos').select('*').limit(20);
  console.log('Sample tickets from tickets_directos:');
  tickets.forEach(t => {
    console.log(`ID: ${t.id} | Cod: ${t.codigo_control} | clasif_admin: ${t.clasificacion_admin} | items: ${JSON.stringify(t.items?.map(i => ({ desc: i.desc || i.descripcion, cat: i.cat || i.categoria, clasif: i.clasif || i.clasificacion })))}`);
  });

  const { data: parts } = await supabase.from('partidas_fondos').select('*').limit(20);
  console.log('\nSample partidas from partidas_fondos:');
  parts.forEach(p => {
    console.log(`ID: ${p.id} | Cod: ${p.codigo_ticket} | clasif: ${p.clasificacion} | cat: ${p.categoria} | desc: ${p.descripcion}`);
  });
}

searchGeneral();
