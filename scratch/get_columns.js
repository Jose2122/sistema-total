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
    const { data, error } = await supabase
      .from('almacen_recepcion')
      .insert([{ this_column_does_not_exist: 'test' }]);
    
    if (error) {
      console.log('Error Message:', error.message);
      console.log('Error Details:', error.details);
      console.log('Error Hint:', error.hint);
    } else {
      console.log('Successfully inserted? That is unexpected!', data);
    }
  } catch (err) {
    console.error('Error running script:', err);
  }
}
run();
