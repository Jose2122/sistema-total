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

const url = `${env.VITE_SUPABASE_URL}/rest/v1/?apikey=${env.VITE_SUPABASE_ANON_KEY}`;

async function main() {
  try {
    const res = await fetch(url);
    const schema = await res.json();
    
    if (schema.definitions && schema.definitions.notificaciones) {
      console.log("Notificaciones Definition:", schema.definitions.notificaciones.properties);
    } else {
      console.log("Could not find notificaciones in definitions. Available tables:", Object.keys(schema.definitions || {}));
    }
  } catch (err) {
    console.error("Error fetching schema:", err);
  }
}

main();
