import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  console.log('--- Buscando ODC 000031 o 31 ---');
  const res = await fetch(`${url}/rest/v1/ordenes_compra?numero=ilike.*31*&select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  console.log('Resultados por numero ilike 31:', data.length);
  for (const odc of data) {
    console.log('ID:', odc.id);
    console.log('Numero:', odc.numero);
    console.log('Requisicion ID:', odc.requisicion_id);
    console.log('Items type:', typeof odc.items);
    console.log('Items:', JSON.stringify(odc.items));
    console.log('Forma de Pago:', odc.forma_pago);
    console.log('Detalle proveedor:', odc.proveedor_nombre, odc.proveedor_rif);
    console.log('Total:', odc.total_general, odc.total);
    console.log('-----------------------------------');
  }

  if (data.length === 0) {
    // Buscar por correlativo en requisiciones
    const res2 = await fetch(`${url}/rest/v1/requisiciones?correlativo=ilike.*RR-MTTO-26-0677*&select=*`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const reqs = await res2.json();
    console.log('Requisicion RR-MTTO-26-0677:', reqs.length);
    for (const r of reqs) {
      console.log('Req ID:', r.id, 'Correlativo:', r.correlativo);
      console.log('Items:', JSON.stringify(r.items));
    }
  }
}

run().catch(console.error);
