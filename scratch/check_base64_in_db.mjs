import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  const queryUrl = `${url}/rest/v1/requisiciones?select=id,justificacion,items,facturas_url&order=id.desc&limit=100`;
  const res = await fetch(queryUrl, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  console.log('Checked 100 requisiciones.');
  let base64Count = 0;
  for (const r of data) {
    const strItems = JSON.stringify(r.items || '');
    const strFact = JSON.stringify(r.facturas_url || '');
    if (strItems.includes('data:image') || strItems.includes('data:application') || strFact.includes('data:image') || strFact.includes('data:application')) {
      base64Count++;
      console.log(`Req #${r.id} (${r.justificacion?.slice(0, 40)}): Items size=${strItems.length} chars, Fact size=${strFact.length} chars`);
    } else if (strItems.length > 50000) {
      console.log(`Req #${r.id} large items: ${strItems.length} chars`);
    }
  }
  console.log(`Total with base64 images: ${base64Count}`);
}

run().catch(console.error);
