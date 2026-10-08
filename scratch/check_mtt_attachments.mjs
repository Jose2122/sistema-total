import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envUrl = '';
let envKey = '';

const envFile = fs.existsSync('.env.local') ? '.env.local' : '.env';
const envContent = fs.readFileSync(envFile, 'utf8');
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}

const supabase = createClient(envUrl, envKey);

async function check() {
  const { data, error } = await supabase
    .from('requisiciones')
    .select('*')
    .ilike('correlativo_req', '%0271%');

  if (error) {
    console.error('Error fetching req:', error);
    return;
  }
  
  console.log(`Found ${data.length} matching requisiciones for 0271.`);
  for (const req of data) {
    console.log('\n=============================================');
    console.log('ID:', req.id, 'Correlativo:', req.correlativo_req, 'Estatus:', req.status_compra);
    console.log('req.facturas_url:', JSON.stringify(req.facturas_url, null, 2));
    if (req.items) {
      console.log(`Items count: ${req.items.length}`);
      req.items.forEach((it, idx) => {
        console.log(`\n  --- Item ${idx + 1}: ${it.nombre || it.descripcion || it.codigo || it.renglon} ---`);
        console.log('  it.adjunto:', it.adjunto);
        console.log('  it.adjuntos:', it.adjuntos);
        console.log('  it.historial_compras:', JSON.stringify(it.historial_compras, null, 2));
      });
    }
  }
}
check();
