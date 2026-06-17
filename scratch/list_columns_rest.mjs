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
    const url = env.VITE_SUPABASE_URL + '/rest/v1/';
    const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
    const res = await fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    console.log("Status:", res.status);
    const schema = await res.json();
    
    console.log("\nTickets_directos schema definitions:");
    if (schema.definitions && schema.definitions.tickets_directos) {
      console.log(JSON.stringify(schema.definitions.tickets_directos.properties, null, 2));
    } else {
      console.log("No definition for tickets_directos");
      console.log("Available definitions:", Object.keys(schema.definitions || {}));
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}
run();
