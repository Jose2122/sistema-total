import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env vars manually
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
const serviceKey = envLocal.VITE_SUPABASE_SERVICE_ROLE_KEY || envRoot.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing Supabase VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in env files.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function run() {
  const rpcNames = ['exec_sql', 'run_sql', 'execute_sql', 'sql'];
  let successfulRpc = null;

  for (const name of rpcNames) {
    try {
      console.log(`Testing RPC with service role key: ${name}...`);
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
    console.log(`Using RPC '${successfulRpc}' to execute migration...`);
    try {
      const q = `
        ALTER TABLE tickets_directos ADD COLUMN IF NOT EXISTS aprobado_por UUID REFERENCES perfiles(id);
        ALTER TABLE tickets_directos ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMP WITH TIME ZONE;
        ALTER TABLE tickets_directos ADD COLUMN IF NOT EXISTS aprobador_id UUID REFERENCES perfiles(id);
      `;
      const { data: resData, error: err } = await supabase.rpc(successfulRpc, { query: q });
      if (err) {
        console.error("Migration error:", err.message);
      } else {
        console.log("Migration executed successfully. Response:", resData);
      }
    } catch (err) {
      console.error("Fatal error during migration execution:", err);
    }
  } else {
    console.error("No working SQL execution RPC found. You must run this SQL manually in your Supabase SQL Editor:\n");
    console.log(`
      ALTER TABLE tickets_directos ADD COLUMN IF NOT EXISTS aprobado_por UUID REFERENCES perfiles(id);
      ALTER TABLE tickets_directos ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMP WITH TIME ZONE;
      ALTER TABLE tickets_directos ADD COLUMN IF NOT EXISTS aprobador_id UUID REFERENCES perfiles(id);
    `);
  }
}

run();
