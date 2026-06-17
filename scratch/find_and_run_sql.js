import { createClient } from '@supabase/supabase-js';
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

// Use service role key if available, fallback to anon key
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
console.log("Using key starting with:", key ? key.substring(0, 10) : 'undefined');

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
    console.log(`Using RPC '${successfulRpc}' to add columns...`);
    try {
      const q1 = `ALTER TABLE requisiciones ADD COLUMN IF NOT EXISTS aplica_rif BOOLEAN DEFAULT FALSE;`;
      const { error: e1 } = await supabase.rpc(successfulRpc, { query: q1 });
      if (e1) console.log("Error adding column to requisiciones:", e1.message);
      else console.log("Added 'aplica_rif' to requisiciones (or it already existed).");

      const q2 = `ALTER TABLE tickets_directos ADD COLUMN IF NOT EXISTS aplica_rif BOOLEAN DEFAULT FALSE;`;
      const { error: e2 } = await supabase.rpc(successfulRpc, { query: q2 });
      if (e2) console.log("Error adding column to tickets_directos:", e2.message);
      else console.log("Added 'aplica_rif' to tickets_directos (or it already existed).");

    } catch (err) {
      console.error("Fatal error during alter table:", err);
    }
  } else {
    console.log("No working SQL execution RPC was found in Supabase.");
  }
}
run();
