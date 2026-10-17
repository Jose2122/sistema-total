import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  const ids = [482, 352, 272, 297, 294, 2102];
  for (const id of ids) {
    const res = await fetch(`${url}/rest/v1/requisiciones?id=eq.${id}&select=id,correlativo_req,facturas_url,items`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const data = await res.json();
    const req = data[0];
    if (!req) continue;
    console.log(`\n================== REQ ${req.id} (${req.correlativo_req}) ==================`);
    console.log('Facturas URL count:', (req.facturas_url || []).length);
    console.log('Facturas URL raw:');
    (req.facturas_url || []).forEach(f => console.log('  ->', f));
    console.log('Items:');
    (req.items || []).forEach((it, idx) => {
      console.log(`  Item [${idx}]: desc="${it.descripcion}" estado_item="${it.estado_item}" cant=${it.cant} pu=${it.pu} total=${it.total} factura_num="${it.factura_num}" proveedor="${it.proveedor}"`);
      if (it.historial_compras) {
        console.log('    historial_compras:', it.historial_compras);
      }
    });
  }
}

run().catch(console.error);
