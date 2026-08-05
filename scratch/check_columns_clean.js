import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};

envContent.split('\n').forEach(line => {
  const cleanLine = line.replace(/\r/g, '').trim();
  const match = cleanLine.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
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
const apiKey = env.VITE_SUPABASE_ANON_KEY;

async function run() {
  console.log("Fetching OpenAPI spec with clean keys...");
  console.log("URL:", supabaseUrl);
  
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!res.ok) {
    console.error("HTTP error:", res.status, res.statusText);
    const text = await res.text();
    console.error("Response body:", text);
    return;
  }

  const spec = await res.json();
  const ticketDef = spec.definitions?.tickets_directos;
  if (ticketDef) {
    console.log("tickets_directos schema properties:");
    console.log(Object.keys(ticketDef.properties));
  } else {
    console.log("tickets_directos definition not found. Definitions available:", Object.keys(spec.definitions || {}));
  }
}

run();
