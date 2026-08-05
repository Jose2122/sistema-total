import { createClient } from '@supabase/supabase-js';
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

const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

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
      console.log(`Testing RPC '${name}'...`);
      const { error } = await supabase.rpc(name, { query: 'SELECT 1;' });
      if (!error) {
        successfulRpc = name;
        console.log(`  RPC '${name}' works!`);
        break;
      } else {
        console.log(`  RPC '${name}' failed:`, error.message);
      }
    } catch (e) {
      console.log(`  RPC '${name}' threw:`, e.message);
    }
  }

  if (successfulRpc) {
    console.log(`Using RPC '${successfulRpc}' to execute migration...`);
    const q = `
      ALTER TABLE tickets_directos ADD COLUMN IF NOT EXISTS observaciones TEXT;
    `;
    const { data, error } = await supabase.rpc(successfulRpc, { query: q });
    if (error) {
      console.error("Migration error:", error.message);
    } else {
      console.log("Migration executed successfully. Result:", data);
    }
  } else {
    console.error("No working SQL RPC found. The SQL statement needs to be executed manually in Supabase SQL Editor:\n");
    console.log("ALTER TABLE tickets_directos ADD COLUMN IF NOT EXISTS observaciones TEXT;");
  }
}

run();
