import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
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
    console.log(schema);
  } catch (e) {
    console.error("Failed:", e);
  }
}
run();
