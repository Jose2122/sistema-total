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

async function searchAll() {
  const { data: reqs, error } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, items');

  if (error) {
    console.error('Error fetching requisiciones:', error);
    return;
  }

  console.log(`Loaded ${reqs.length} requisiciones. Searching...`);

  const terms = [
    '50490259',
    '11290860',
    'ls11290820',
    '04127643063',
    '04246890510',
    '8233',
    '2169',
    'HIDROBOMBAS',
    'INDRINA',
    'ADRIZORCA',
    'HUBY',
    'JF MURO',
    'OCANDO',
    'BELLA VISTA',
    'SANATORIO',
    'MORGADO',
    'VALBUENA',
    'ANDRADE',
    'FARIAS',
    'IWECOTECH',
    'IWOSA',
    'FACCINI',
    'GARCIAS RIVAS'
  ];

  terms.forEach(t => {
    const found = reqs.filter(r => JSON.stringify(r).toUpperCase().includes(t.toUpperCase()));
    console.log(`\n=== Term: "${t}" -> Matches: ${found.length} ===`);
    found.forEach(f => {
      const json = JSON.stringify(f);
      const idx = json.toUpperCase().indexOf(t.toUpperCase());
      console.log(`  Req: ${f.correlativo_req} | Context: ${json.substring(Math.max(0, idx - 80), Math.min(json.length, idx + 120))}`);
    });
  });
}

searchAll();
