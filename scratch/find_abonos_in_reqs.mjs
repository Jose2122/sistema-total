import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  console.log('--- Buscando abonos en facturas_url de requisiciones ---');
  // Paginado de requisiciones
  let page = 0;
  let abonosFound = [];
  while (true) {
    const res = await fetch(`${url}/rest/v1/requisiciones?select=id,correlativo_req,solicitante,facturas_url&order=id.desc&offset=${page * 500}&limit=500`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const data = await res.json();
    if (!data || data.length === 0) break;
    for (const r of data) {
      const fUrls = r.facturas_url || [];
      const str = JSON.stringify(fUrls);
      if (str.toLowerCase().includes('abono') || str.toLowerCase().includes('elizabeth')) {
        abonosFound.push({
          reqId: r.id,
          correlativo: r.correlativo_req,
          content: fUrls
        });
      }
    }
    if (data.length < 500) break;
    page++;
  }

  console.log(`Encontradas ${abonosFound.length} requisiciones con abonos en facturas_url:`);
  for (const item of abonosFound) {
    console.log(`\nReq ID: ${item.reqId} (${item.correlativo}):`);
    console.dir(item.content, { depth: null });
  }
}

run().catch(console.error);
