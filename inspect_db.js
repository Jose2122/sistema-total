import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
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
    const { data, error } = await supabase.from('tickets_directos').select('*').limit(1);
    if (error) throw error;
    if (data && data.length > 0) {
      console.log('Keys of tickets_directos:', Object.keys(data[0]));
      console.log('Sample ticket:', JSON.stringify(data[0], null, 2));
    } else {
      console.log('No tickets found in tickets_directos');
    }
  } catch (err) {
    console.error('Error running inspect script:', err);
  }
}
run();
