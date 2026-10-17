import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  // Let's test a simple update on requisicion 2014 to see how long it takes
  console.log('Testing update on requisicion 2014...');
  const start = Date.now();
  const res = await fetch(`${url}/rest/v1/requisiciones?id=eq.2014`, {
    method: 'PATCH',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      updated_at: new Date().toISOString()
    })
  });
  const elapsed = Date.now() - start;
  console.log(`Status: ${res.status} ${res.statusText} in ${elapsed}ms`);
  const text = await res.text();
  console.log('Body:', text || '(empty)');
}

run().catch(console.error);
