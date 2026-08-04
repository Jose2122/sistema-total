import fs from 'fs';
import path from 'path';

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

const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

async function run() {
  console.log("Fetching OpenAPI spec...");
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });

  if (!res.ok) {
    console.error("HTTP error:", res.status, res.statusText);
    return;
  }

  const spec = await res.json();
  const ticketDef = spec.definitions?.tickets_directos;
  if (ticketDef) {
    console.log("tickets_directos schema definition:");
    console.log(JSON.stringify(ticketDef, null, 2));
  } else {
    console.log("tickets_directos definition not found. Definitions available:", Object.keys(spec.definitions || {}));
  }
}

run();
