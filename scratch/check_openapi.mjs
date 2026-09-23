import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

async function run() {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`
    }
  });
  const schema = await res.json();
  const odcProps = schema.definitions?.ordenes_compra?.properties;
  console.log('ordenes_compra columns:', Object.keys(odcProps || {}));
  const provProps = schema.definitions?.proveedores?.properties;
  console.log('proveedores columns:', Object.keys(provProps || {}));
}

run();
