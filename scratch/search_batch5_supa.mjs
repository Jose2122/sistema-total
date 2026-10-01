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

async function searchBatch5() {
  const { data: reqs, error } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, items');

  if (error) return console.error('Error:', error);

  const terms = [
    '30045684', '30089263', '30593070', '29616859', '30713850', '50034104',
    '31601550', '07017217', '11582145', '40004091', '30726213',
    '50254615', '20370510', '50488657', '29780707', '40558032',
    '50582768', '07826676', '09730875', '18987383', '58695231',
    '40454759', '31559921'
  ];

  terms.forEach(t => {
    const found = reqs.filter(r => JSON.stringify(r).includes(t));
    console.log(`\n=== Term: "${t}" -> Matches: ${found.length} ===`);
    found.forEach(f => {
      const json = JSON.stringify(f);
      const idx = json.indexOf(t);
      console.log(`  Req: ${f.correlativo_req} | Context: ${json.substring(Math.max(0, idx - 60), Math.min(json.length, idx + 100))}`);
    });
  });
}

searchBatch5();
