import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually
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
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const key = env.VITE_SUPABASE_ANON_KEY;
console.log("Using key from .env starting with:", key ? key.substring(0, 15) : 'undefined');

const supabase = createClient(env.VITE_SUPABASE_URL, key);

async function run() {
  const rpcNames = ['exec_sql', 'run_sql', 'execute_sql', 'sql'];
  let successfulRpc = null;

  for (const name of rpcNames) {
    try {
      console.log(`Testing RPC: ${name}...`);
      const { data, error } = await supabase.rpc(name, { query: 'SELECT 1;' });
      if (!error) {
        console.log(`  Success! RPC ${name} exists.`);
        successfulRpc = name;
        break;
      } else {
        console.log(`  RPC ${name} returned error: ${error.message}`);
      }
    } catch (e) {
      console.log(`  RPC ${name} fatal error: ${e.message}`);
    }
  }

  if (successfulRpc) {
    console.log(`Using RPC '${successfulRpc}' to add column to tickets_directos...`);
    try {
      const q = `ALTER TABLE tickets_directos ADD COLUMN IF NOT EXISTS prioridad TEXT DEFAULT 'Normal';`;
      const { data: resData, error: err } = await supabase.rpc(successfulRpc, { query: q });
      if (err) {
        console.log("Error adding column to tickets_directos:", err.message);
      } else {
        console.log("Added 'prioridad' to tickets_directos (or it already existed). Response:", resData);
      }
    } catch (err) {
      console.error("Fatal error during alter table:", err);
    }
  } else {
    console.log("No working SQL execution RPC was found in Supabase.");
  }
}
run();
