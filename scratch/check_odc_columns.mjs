import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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
    }
    env[key] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('ordenes_compra').select('*').limit(1);
  if (error) {
    console.error('Error fetching odc schema:', error);
  } else if (data && data.length > 0) {
    console.log('ODC Columns:', Object.keys(data[0]));
    console.log('ODC Sample row:', data[0]);
  } else {
    console.log('No rows returned from ordenes_compra');
  }
}

run();
