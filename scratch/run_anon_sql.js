import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const loadEnv = (filename) => {
  const envPath = path.resolve(filename);
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  content.split('\n').forEach(line => {
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
  return env;
};

const envLocal = loadEnv('.env.local');
const envRoot = loadEnv('.env');

const url = envLocal.VITE_SUPABASE_URL || envRoot.VITE_SUPABASE_URL;
const anonKey = envLocal.VITE_SUPABASE_ANON_KEY || envRoot.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing URL or Anon Key.");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

async function run() {
  const rpcNames = ['exec_sql', 'run_sql', 'execute_sql', 'sql'];
  let successfulRpc = null;

  for (const name of rpcNames) {
    try {
      const { error } = await supabase.rpc(name, { query: 'SELECT 1;' });
      if (!error) {
        successfulRpc = name;
        break;
      }
    } catch (e) {}
  }

  if (successfulRpc) {
    console.log(`Using RPC '${successfulRpc}'...`);
    const q = `
      ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS cuentas_bancarias JSONB DEFAULT '[]'::jsonb;
    `;
    const { data, error } = await supabase.rpc(successfulRpc, { query: q });
    if (error) {
      console.error("Migration error:", error.message);
    } else {
      console.log("Migration executed successfully:", data);
    }
  } else {
    console.error("No working SQL RPC found.");
  }
}

run();
