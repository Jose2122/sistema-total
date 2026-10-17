import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  const odcId = 'a88b69c3-2776-49d4-9509-b5a6dfa91b22';
  const res = await fetch(`${url}/rest/v1/ordenes_compra_items?orden_compra_id=eq.${odcId}&select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  console.log('Items in ordenes_compra_items for odc_id:', odcId);
  console.log('Count:', data.length, 'Data:', data);

  // Let's also check all items in ordenes_compra_items
  const allRes = await fetch(`${url}/rest/v1/ordenes_compra_items?select=id,orden_compra_id,descripcion,cantidad,precio_unitario&limit=10`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const allData = await allRes.json();
  console.log('Sample from ordenes_compra_items:', allData);
}

run().catch(console.error);
