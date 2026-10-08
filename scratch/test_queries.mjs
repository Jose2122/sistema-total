import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let envUrl = '', envKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(envUrl, envKey);

async function testQuery() {
  const { data: tkts, error: tkError } = await supabase.from('tickets_directos').select('*');
  console.log('tickets_directos count:', tkts?.length, 'error:', tkError);
  if (tkts && tkts.length > 0) {
    console.log('First ticket:', tkts[0]);
  }

  const { data: sf, error: sfError } = await supabase.from('solicitudes_fondos').select('*');
  console.log('solicitudes_fondos count:', sf?.length, 'error:', sfError);

  const { data: odc, error: odcError } = await supabase.from('ordenes_compra').select('*');
  console.log('ordenes_compra count:', odc?.length, 'error:', odcError);
}

testQuery();
