import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  const queryUrl = `${url}/rest/v1/requisiciones?correlativo_req=ilike.*0677*&select=*`;
  const res = await fetch(queryUrl, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  console.log('Status:', res.status, 'Response:', data);
  if (!Array.isArray(data)) return;
  for (const r of data) {
    console.log('ID:', r.id);
    console.log('Correlativo:', r.correlativo || r.correlativo_req);
    console.log('Proveedor:', r.proveedor, r.proveedor_seleccionado);
    console.log('Items type:', typeof r.items);
    console.log('Items count:', Array.isArray(r.items) ? r.items.length : 'not array');
    console.log('Items sample:', JSON.stringify(r.items).slice(0, 500));
    console.log('Facturas URL:', r.facturas_url);
    console.log('ODC numero:', r.odc_numero || r.numero_odc || r.orden_compra_numero);
  }
}

run().catch(console.error);
