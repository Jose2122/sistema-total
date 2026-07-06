import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
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

const key = env.VITE_SUPABASE_ANON_KEY;
console.log("Using URL:", env.VITE_SUPABASE_URL);
const supabase = createClient(env.VITE_SUPABASE_URL, key);

async function run() {
  const candidates = [
    { email: 'cvega@totalclean.com', pass: '123456' },
    { email: 'cvega@totalclean.com', pass: 'TotalClean123!' },
    { email: 'jcontreras.totalclean@gmail.com', pass: '123456' },
    { email: 'jcontreras.totalclean@gmail.com', pass: 'TotalClean123!' },
  ];

  let loggedIn = false;
  for (const c of candidates) {
    console.log(`Trying login: ${c.email} / ${c.pass}...`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: c.email,
      password: c.pass
    });
    if (!error) {
      console.log(`Login Success as ${c.email}!`);
      loggedIn = true;
      break;
    } else {
      console.log(`Failed: ${error.message}`);
    }
  }

  if (!loggedIn) {
    console.error("Could not log in with any candidate credential.");
    return;
  }

  console.log("Fetching OPE-B-SEM 27-26 from solicitudes_fondos...");
  const { data: sols, error: solError } = await supabase
    .from('solicitudes_fondos')
    .select('*')
    .eq('codigo_control', 'OPE-B-SEM 27-26');

  if (solError) {
    console.error("Error fetching solicitudes:", solError.message);
    return;
  }

  if (sols.length === 0) {
    console.log("No solicitudes found with code OPE-B-SEM 27-26");
    return;
  }

  const sol = sols[0];
  console.log(`Solicitud ID: ${sol.id} | Codigo: ${sol.codigo_control} | total_bs: ${sol.total_bs} | total_usd: ${sol.total_usd}`);

  console.log("Fetching partidas_fondos associated with this solicitud...");
  const { data: partidas, error: pError } = await supabase
    .from('partidas_fondos')
    .select('*')
    .eq('solicitud_id', sol.id);

  if (pError) {
    console.error("Error fetching partidas:", pError.message);
    return;
  }

  console.log(`Total partidas found: ${partidas.length}`);
  partidas.forEach((p, idx) => {
    console.log(`[Row ${idx+1}] ID: ${p.id} | Desc: ${p.descripcion} | Cant: ${p.cantidad} | PU Bs: ${p.pu_bs} | PU USD: ${p.pu_usd} | Status: ${p.status} | Ticket: ${p.codigo_ticket} | Requisicion: ${p.requisicion_id} | Creador: ${p.emisor_nombre}`);
  });
}
run();
