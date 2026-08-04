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

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Fetching one ticket to inspect keys...");
  const { data, error } = await supabase
    .from('tickets_directos')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching ticket:", error);
    return;
  }

  if (data && data.length > 0) {
    console.log("Columns in tickets_directos:", Object.keys(data[0]));
    console.log("Sample ticket:", JSON.stringify(data[0], null, 2));
  } else {
    console.log("No tickets found. Let's list table info from information_schema if possible.");
    const { data: schemaData, error: schemaError } = await supabase.rpc('exec_sql', {
      query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tickets_directos';"
    });
    if (schemaError) {
      console.error("Error fetching from information_schema:", schemaError);
    } else {
      console.log("Columns:", schemaData);
    }
  }
}

run();
