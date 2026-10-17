import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  const start = Date.now();
  const res = await fetch(`${url}/rest/v1/requisiciones?items=ilike.*doc_numero*&select=id,justificacion&limit=5`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  console.log(`Query took: ${Date.now() - start} ms, found: ${data.length}`);
  console.log(data);
}

run().catch(console.error);
