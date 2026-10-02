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

async function inspectWithAuth() {
  const { data: auth, error: aErr } = await supabase.auth.signInWithPassword({
    email: 'jcontreras.totalclean@gmail.com',
    password: 'TotalClean123!'
  });

  if (aErr) {
    const { data: auth2, error: aErr2 } = await supabase.auth.signInWithPassword({
      email: 'karincmm1@gmail.com',
      password: '123456'
    });
    if (aErr2) return console.error('Auth error:', aErr2);
  }

  const { data: tickets, error: tErr } = await supabase
    .from('tickets_directos')
    .select('*')
    .limit(10);

  if (tErr) console.error('Tickets error:', tErr);
  else {
    console.log(`Found ${tickets.length} tickets.`);
    tickets.forEach(t => {
      console.log(`\nTicket ID: ${t.id} | Cod: ${t.codigo_control} | clasif_admin: "${t.clasificacion_admin}" | desc: "${t.descripcion}"`);
      console.log('Items:', JSON.stringify(t.items, null, 2));
    });
  }

  const { data: parts, error: pErr } = await supabase
    .from('partidas_fondos')
    .select('*')
    .limit(10);

  if (pErr) console.error('Partidas error:', pErr);
  else {
    console.log(`\nFound ${parts.length} partidas.`);
    parts.forEach(p => {
      console.log(`Partida ID: ${p.id} | Cod: ${p.codigo_ticket} | clasif: "${p.clasificacion}" | cat: "${p.categoria}" | desc: "${p.descripcion}"`);
    });
  }
}

inspectWithAuth();
