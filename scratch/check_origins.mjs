import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let envUrl = '', envKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(envUrl, envKey);

async function checkReqs() {
  const { data } = await supabase.from('requisiciones').select('id, origen, correlativo_req');
  const origenes = {};
  const prefixes = {};

  (data || []).forEach(r => {
    origenes[r.origen || 'null'] = (origenes[r.origen || 'null'] || 0) + 1;
    const prefix = (r.correlativo_req || '').split('-')[0] || 'SIN_PREFIJO';
    prefixes[prefix] = (prefixes[prefix] || 0) + 1;
  });

  console.log('Orígenes en requisiciones:', origenes);
  console.log('Prefijos correlativo_req:', prefixes);
}

checkReqs();
