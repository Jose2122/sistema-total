import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let envUrl = '', envKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(envUrl, envKey);

async function checkReqsForTickets() {
  const { data } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, origen, justificacion, items')
    .or('origen.ilike.%ticket%,justificacion.ilike.%ticket%,correlativo_req.ilike.%TCK%,correlativo_req.ilike.%TKT%');

  console.log('Requisiciones matching ticket keywords:', data?.length);
  if (data && data.length > 0) {
    console.log(data.slice(0, 5));
  }
}

checkReqsForTickets();
