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

async function searchSol() {
  const { data: sols, error } = await supabase
    .from('solicitudes_fondos')
    .select('*');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Loaded ${sols.length} solicitudes_fondos.`);

  const terms = ['50490259', '11290860', '04246890510', 'ls11290820', '04127643063', 'HUBY', '8233', '2169', 'ADRIZORCA', '0414-6368018'];
  terms.forEach(t => {
    const matches = sols.filter(s => JSON.stringify(s).toUpperCase().includes(t.toUpperCase()));
    console.log(`\n=== Match for "${t}": ${matches.length} ===`);
    matches.forEach(m => {
      console.log('  ', m.correlativo || m.id, '|', m.proveedor || m.beneficiario, '|', m.rif_proveedor || m.rif, '|', m.telefono);
    });
  });
}

searchSol();
