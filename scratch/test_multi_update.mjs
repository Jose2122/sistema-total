import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  // 1. Get the latest 5 requisiciones
  const q = await fetch(`${url}/rest/v1/requisiciones?select=id&order=id.desc&limit=5`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const list = await q.json();
  console.log('Testing updates on latest requisiciones:', list.map(x => x.id));
  
  for (const item of list) {
    const start = Date.now();
    const res = await fetch(`${url}/rest/v1/requisiciones?id=eq.${item.id}`, {
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
    console.log(`Req #${item.id}: status=${res.status} in ${elapsed}ms`);
    if (res.status >= 400) {
      console.log('Error:', await res.text());
    }
  }
}

run().catch(console.error);
