import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value.trim();
  }
});

async function run() {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/?apikey=${env.VITE_SUPABASE_ANON_KEY}`, {
    headers: {
      Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`
    }
  });
  const spec = await res.json();
  fs.writeFileSync('scratch/openapi_dump.json', JSON.stringify(spec, null, 2));
  console.log('Saved openapi_dump.json. Keys:', Object.keys(spec));
  if (spec.definitions) {
    console.log('Definitions:', Object.keys(spec.definitions));
    if (spec.definitions.ordenes_compra) {
      console.log('ordenes_compra columns:', Object.keys(spec.definitions.ordenes_compra.properties || {}));
    }
  }
}

run();
