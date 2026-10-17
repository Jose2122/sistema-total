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
  console.log('Original Count:', fUrls.length);

  // Filter out duplicate base64 / URLs
  const seenKeys = new Set();
  const cleanUrls = [];

  for (const item of fUrls) {
    let rawUrl = item;
    let etiqueta = '';
    if (typeof item === 'string' && item.startsWith('{')) {
      try {
        const p = JSON.parse(item);
        rawUrl = p.url || item;
        etiqueta = p.etiqueta || '';
      } catch {}
    } else if (item && typeof item === 'object') {
      rawUrl = item.url || '';
      etiqueta = item.etiqueta || '';
    }
    const key = typeof rawUrl === 'string' && rawUrl.startsWith('data:')
      ? `b64_${rawUrl.length}_${rawUrl.slice(0, 100)}`
      : String(rawUrl).split('?')[0].toLowerCase();

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      cleanUrls.push(item);
      console.log('Keeping:', etiqueta, key.slice(0, 40));
    } else {
      console.log('Discarding duplicate:', etiqueta, key.slice(0, 40));
    }
  }

  console.log('Clean Count:', cleanUrls.length);

  // Update in DB
  const updateRes = await fetch(`${url}/rest/v1/requisiciones?id=eq.2014`, {
    method: 'PATCH',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ facturas_url: cleanUrls })
  });

  console.log('Update status:', updateRes.status);
}

run().catch(console.error);
