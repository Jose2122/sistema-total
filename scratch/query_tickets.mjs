import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Querying tickets_directos...");
  const { data, error } = await supabase.from('tickets_directos').select('*').limit(5);
  if (error) {
    console.error("Error querying tickets_directos:", error.message);
  } else {
    console.log(`Successfully fetched ${data ? data.length : 0} tickets.`);
    if (data && data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
      console.log("Sample ticket:", JSON.stringify(data[0], null, 2));
    }
  }
}
run();
