import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  console.log('Checking references to requisicion 2014...');
  
  // 1. partidas_fondos
  const pRes = await fetch(`${url}/rest/v1/partidas_fondos?requisicion_id=eq.2014`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log('partidas_fondos status:', pRes.status);
  const pText = await pRes.text();
  console.log('partidas_fondos body:', pText.slice(0, 200));

  // 2. ordenes_compra
  const oRes = await fetch(`${url}/rest/v1/ordenes_compra?requisicion_id=eq.2014`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log('ordenes_compra status:', oRes.status);
  const oText = await oRes.text();
  console.log('ordenes_compra body:', oText.slice(0, 200));

  // 3. Let's check requisicion 2014 complete row
  const rRes = await fetch(`${url}/rest/v1/requisiciones?id=eq.2014`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log('requisicion status:', rRes.status);
  const rText = await rRes.text();
  console.log('requisicion body:', rText.slice(0, 200));
}

run().catch(console.error);
