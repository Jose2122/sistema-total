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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  try {
    // Attempt to select the 'prioridad' column from 'tickets_directos'
    const { data, error } = await supabase
      .from('tickets_directos')
      .select('prioridad')
      .limit(1);

    if (error) {
      console.log("Error querying 'prioridad' column:", error.message);
    } else {
      console.log("Successfully queried 'prioridad' column! It exists. Data:", data);
    }
  } catch (e) {
    console.error("Exception:", e.message);
  }
}

run();
