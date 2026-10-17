import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

const res = await fetch(`${url}/rest/v1/requisiciones?id=in.(352,272)&select=id,correlativo_req,items,facturas_url`, {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
});
const data = await res.json();
for (const d of data) {
  console.log('ID:', d.id, d.correlativo_req);
  console.log('ITEMS:', JSON.stringify(d.items, null, 2));
}
