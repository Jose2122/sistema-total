import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

const start = Date.now();
fetch(`${url}/rest/v1/requisiciones?select=id,items,facturas_url&order=id.desc&limit=200`, {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
}).then(r => r.text()).then(t => {
  console.log('Query took:', Date.now() - start, 'ms, response size:', t.length, 'bytes');
}).catch(console.error);
