import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  const queryUrl = `${url}/rest/v1/requisiciones?justificacion=ilike.*CILINDROS*&select=id,justificacion,items,facturas_url,total_bs`;
  const res = await fetch(queryUrl, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  console.log('Response:', data);
  if (!Array.isArray(data)) return;
  for (const req of data) {
    console.log('=== Requisición ===');
    console.log('ID:', req.id);
    console.log('Correlativo:', req.correlativo);
    console.log('Facturas URL:', JSON.stringify(req.facturas_url, null, 2));
    const itemsStr = JSON.stringify(req.items);
    console.log('Items JSON length (chars):', itemsStr.length);
    if (itemsStr.includes('data:image') || itemsStr.includes('data:application')) {
      console.log('>>> WARNING: items contains base64 data URLs! <<<');
    }
    // Inspect each item in items
    if (Array.isArray(req.items)) {
      req.items.forEach((it, idx) => {
        console.log(`Item #${idx + 1} (${it.descripcion}):`);
        console.log(`  historial_compras count: ${(it.historial_compras || []).length}`);
        (it.historial_compras || []).forEach((h, hIdx) => {
          const keys = Object.keys(h);
          console.log(`    H#${hIdx + 1}: cant=${h.cant}, pu=${h.pu}, url length=${(h.url || h.factura_url || h.soporte_url || '').length}, isBase64=${(h.url || '').startsWith('data:')}`);
        });
      });
    }
  }
}

run().catch(console.error);
