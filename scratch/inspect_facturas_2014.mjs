import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');

async function run() {
  const queryUrl = `${url}/rest/v1/requisiciones?id=eq.2014&select=id,facturas_url`;
  const res = await fetch(queryUrl, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  const fUrls = data[0]?.facturas_url || [];
  console.log('Count:', fUrls.length);
  fUrls.forEach((item, idx) => {
    let parsed = item;
    if (typeof item === 'string' && item.startsWith('{')) {
      try { parsed = JSON.parse(item); } catch {}
    }
    const u = parsed.url || parsed;
    console.log(`[${idx}] etiqueta: "${parsed.etiqueta || ''}", url length: ${u.length}, prefix: ${u.slice(0, 50)}...`);
  });

  if (fUrls.length >= 3) {
    const u1 = (typeof fUrls[1] === 'string' ? JSON.parse(fUrls[1]) : fUrls[1]).url;
    const u2 = (typeof fUrls[2] === 'string' ? JSON.parse(fUrls[2]) : fUrls[2]).url;
    console.log('Is u1 === u2 ?', u1 === u2);
    console.log('u1 length:', u1.length, 'u2 length:', u2.length);
  }
}

run().catch(console.error);
