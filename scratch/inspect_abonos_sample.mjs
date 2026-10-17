import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function test() {
  const res = await fetch(`${url}/rest/v1/requisiciones?id=in.(482,352,272,297,294,220,362)&select=id,correlativo_req,items,facturas_url`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  for (const r of data) {
    console.log('=== REQ ID:', r.id, r.correlativo_req);
    console.log('ITEMS:', JSON.stringify(r.items, null, 2));
    console.log('FACTURAS_URL:', JSON.stringify(r.facturas_url, null, 2));
  }
}
test().catch(console.error);
