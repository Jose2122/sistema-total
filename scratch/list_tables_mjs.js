import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = path.resolve('.env.local');
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

async function run() {
  try {
    const url = `${env.VITE_SUPABASE_URL}/rest/v1/`;
    const response = await fetch(url, {
      headers: {
        'apikey': env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
        'Accept': 'application/openapi+json'
      }
    });
    const schema = await response.json();
    if (schema.error || !schema.paths) {
      console.log('API Response Schema:', schema);
    } else {
      const tables = Object.keys(schema.paths)
        .map(p => p.split('/')[1])
        .filter((v, i, a) => v && a.indexOf(v) === i);
      console.log('Tables:', tables);
    }
  } catch (e) {
    console.error('Error:', e);
  }
}
run();
