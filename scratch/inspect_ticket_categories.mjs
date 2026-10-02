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

async function inspectTickets() {
  const codes = ['TP-SVG-26-069', 'TP-RRH-26-233', 'TP-ADM-TG-26-249', 'TP-OPE-26-158', 'TP-SVG-26-068', 'TP-RRH-26-232'];

  console.log('=== TICKETS_DIRECTOS ===');
  const { data: tickets, error: tErr } = await supabase
    .from('tickets_directos')
    .select('*')
    .in('codigo_control', codes);

  if (tErr) console.error('Error tickets:', tErr);
  else {
    tickets.forEach(t => {
      console.log(`\nTicket: ${t.codigo_control} | clasificacion_admin: "${t.clasificacion_admin}" | categoria: "${t.categoria}"`);
      console.log('Items:', JSON.stringify(t.items, null, 2));
    });
  }

  console.log('\n=== PARTIDAS_FONDOS ===');
  const { data: partidas, error: pErr } = await supabase
    .from('partidas_fondos')
    .select('*')
    .in('codigo_ticket', codes);

  if (pErr) console.error('Error partidas:', pErr);
  else {
    partidas.forEach(p => {
      console.log(`\nPartida: ${p.codigo_ticket} | clasificacion: "${p.clasificacion}" | categoria: "${p.categoria}" | desc: "${p.descripcion}"`);
    });
  }
}

inspectTickets();
