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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  try {
    const { data: profiles, error: err } = await supabase.from('perfiles').select('*').limit(1);
    if (err) throw err;
    if (profiles && profiles.length > 0) {
      console.log('Columns of perfiles:', Object.keys(profiles[0]));
      console.log('Sample profile:', JSON.stringify(profiles[0], null, 2));
    } else {
      console.log('No rows in perfiles.');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
