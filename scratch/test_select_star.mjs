import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let envUrl = '', envKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(envUrl, envKey);

async function testSelectStar() {
  const fetchAll = async (table) => {
    let all = [];
    let page = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (error) {
        console.error(`Error on ${table}:`, error.message);
        break;
      }
      if (data && data.length > 0) {
        all = all.concat(data);
        if (data.length < 1000) break;
        page++;
      } else {
        break;
      }
    }
    return all;
  };

  const reqs = await fetchAll('requisiciones');
  console.log(`Requisiciones count: ${reqs.length}`);

  const logs = await fetchAll('requisicion_logs');
  console.log(`Requisicion Logs count: ${logs.length}`);

  const tkts = await fetchAll('tickets_directos');
  console.log(`Tickets Directos count: ${tkts.length}`);

  const odcs = await fetchAll('ordenes_compra');
  console.log(`Ordenes Compra count: ${odcs.length}`);
}

testSelectStar();
