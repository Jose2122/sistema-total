const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const { data, error } = await supabase
    .from('tickets_directos')
    .select('id, codigo_control, departamento, status, fecha_emision, fecha, items, total_usd, monto')
    .neq('status', 'RECHAZADO');

  if (error) {
    console.error("Error fetching tickets:", error);
    return;
  }

  console.log(`Found ${data.length} non-rejected tickets:`);
  let countWithPositiveAmount = 0;
  
  data.forEach((t, i) => {
    // calculate ticket total like ResumenEjecutivo does
    const items = Array.isArray(t.items) ? t.items : [];
    let itemsTotal = 0;
    if (items.length > 0) {
      itemsTotal = items.reduce((sum, item) => sum + (Number(item.total) || (Number(item.cant || 1) * Number(item.puUsd || item.puBs || item.pu || 0))), 0);
    }
    const fallbackTotal = Number(t.total_usd || t.monto || 0);
    const getTicketTotalVal = itemsTotal > 0 ? itemsTotal : fallbackTotal;
    
    if (getTicketTotalVal > 0) {
      countWithPositiveAmount++;
      if (countWithPositiveAmount <= 15) {
        console.log(`Ticket ${t.codigo_control || t.id}:`);
        console.log(`  Dept: ${t.departamento}`);
        console.log(`  Status: ${t.status}`);
        console.log(`  Fecha Emision: ${t.fecha_emision}`);
        console.log(`  Fecha: ${t.fecha}`);
        console.log(`  Items length: ${items.length}`);
        console.log(`  Items computed total: ${itemsTotal}`);
        console.log(`  total_usd: ${t.total_usd}, monto: ${t.monto}`);
        console.log(`  Resolved Total: ${getTicketTotalVal}`);
      }
    }
  });
  
  console.log(`Total tickets with positive amount: ${countWithPositiveAmount} out of ${data.length}`);
}

run();
