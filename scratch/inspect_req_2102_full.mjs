import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  const res = await fetch(`${url}/rest/v1/requisiciones?id=eq.2102&select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  const req = data[0];
  console.log('Requisicion ID:', req.id, 'Correlativo:', req.correlativo_req);
  console.log('Justificacion:', req.justificacion);
  console.log('Items full:');
  console.dir(req.items, { depth: null });
}

run().catch(console.error);
