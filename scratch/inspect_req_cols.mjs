import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '').replace('\r', '');
    env[k] = v;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspectReqColumns() {
  const { data, error } = await supabase.from('requisiciones').select('*').limit(1);
  if (data && data[0]) {
    console.log("Requisiciones columns:", Object.keys(data[0]));
    console.log("Sample row:", data[0]);
  } else {
    console.log("Error:", error);
  }
}

inspectReqColumns();
