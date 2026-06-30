import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  envPath = path.resolve('.env.local');
}
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const url = `${env.VITE_SUPABASE_URL}/rest/v1/`;
const headers = {
  'apikey': env.VITE_SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
  'Accept': 'application/openapi+json'
};

async function run() {
  try {
    const response = await fetch(url, { headers });
    const schema = await response.json();
    console.log("Paths (endpoints):", Object.keys(schema.paths || {}).filter(p => p.startsWith('/rpc/')));
  } catch (e) {
    console.error("Failed to inspect schema:", e);
  }
}
run();
