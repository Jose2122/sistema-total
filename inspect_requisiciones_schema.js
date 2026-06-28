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
    }
    env[key] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  try {
    const { data, error } = await supabase.from('requisiciones').select('*').limit(1);
    if (error) throw error;
    if (data && data.length > 0) {
      console.log('Keys of requisiciones:', Object.keys(data[0]));
      console.log('Sample requisition item 0:', JSON.stringify(data[0].items?.[0] || data[0].items || {}, null, 2));
      console.log('Requisition columns:', Object.keys(data[0]));
    } else {
      console.log('No requisitions found');
    }
  } catch (err) {
    console.error('Error running inspect:', err);
  }
}
run();
