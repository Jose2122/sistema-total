import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  const queryUrl = `${url}/rest/v1/ordenes_compra?requisicion_id=eq.2102&select=*`;
  const res = await fetch(queryUrl, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  console.log('Status:', res.status, 'ODCs for req 2102:', data);

  // Also query ordenes_compra without filter, but check why limit=3 was empty
  const qAll = `${url}/rest/v1/ordenes_compra?select=id,numero,correlativo,requisicion_id,proveedor_nombre,total&limit=10`;
  const resAll = await fetch(qAll, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log('All ODCs sample:', await resAll.json());
}

run().catch(console.error);
