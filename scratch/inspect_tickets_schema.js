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
    const { data, error } = await supabase.from('tickets_directos').select('*').limit(3);
    if (error) {
      console.error(error);
    } else {
      console.log('Columns:');
      if (data.length > 0) {
        console.log(Object.keys(data[0]));
        console.log('Sample item structure:');
        console.dir(data[0], { depth: null });
      } else {
        console.log('No data found in tickets_directos');
      }
    }
  } catch (err) {
    console.error(err);
  }
}
run();
