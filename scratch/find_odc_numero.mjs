import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  const queryUrl = `${url}/rest/v1/ordenes_compra?numero_odc=ilike.*31*&select=*`;
  const res = await fetch(queryUrl, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  console.log('Status:', res.status, 'Count:', data.length);
  for (const o of data) {
    console.log('ODC ID:', o.id);
    console.log('numero_odc:', o.numero_odc);
    console.log('requisicion_id:', o.requisicion_id);
    console.log('proveedor_nombre:', o.proveedor_nombre);
    console.log('forma_pago:', o.forma_pago);
    console.log('condicion_pago:', o.condicion_pago);
    console.log('dias_credito:', o.dias_credito);
    console.log('total_general:', o.total_general, 'total_neto:', o.total_neto, 'subtotal:', o.subtotal);
    console.log('destino_despacho:', o.destino_despacho);
    console.log('observaciones:', o.observaciones);

    // Let's also check items for this ODC in ordenes_compra_items
    const itemsRes = await fetch(`${url}/rest/v1/ordenes_compra_items?orden_compra_id=eq.${o.id}&select=*`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const items = await itemsRes.json();
    console.log(`Items in ordenes_compra_items (count=${items.length}):`, items);
  }
}

run().catch(console.error);
