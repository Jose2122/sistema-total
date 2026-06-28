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

const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
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
    console.log(`Using RPC '${successfulRpc}' to add columns to perfiles...`);
    try {
      const q1 = `ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS gerente_directo_id UUID REFERENCES perfiles(id);`;
      const { error: e1 } = await supabase.rpc(successfulRpc, { query: q1 });
      if (e1) console.log("Error adding gerente_directo_id:", e1.message);
      else console.log("Added 'gerente_directo_id' to perfiles.");

      const q2 = `ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS gerente_directo_nombre TEXT;`;
      const { error: e2 } = await supabase.rpc(successfulRpc, { query: q2 });
      if (e2) console.log("Error adding gerente_directo_nombre:", e2.message);
      else console.log("Added 'gerente_directo_nombre' to perfiles.");

    } catch (err) {
      console.error("Fatal error during alter table:", err);
    }
  } else {
    console.log("No working SQL execution RPC was found. Columns must be added manually or through the Supabase Dashboard SQL editor:");
    console.log("ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS gerente_directo_id UUID REFERENCES perfiles(id);");
    console.log("ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS gerente_directo_nombre TEXT;");
  }
}
run();
