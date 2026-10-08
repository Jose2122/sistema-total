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
  const { data, error } = await supabase.from('ordenes_compra').select('*').limit(3);
  if (error) {
    console.error('Error fetching ordenes_compra:', error);
  } else {
    console.log('ordenes_compra count:', data.length);
    if (data.length > 0) {
      console.log('Columns in ordenes_compra:', Object.keys(data[0]));
      console.log('Sample row:', data[0]);
    }
  }

  const { data: itemsData, error: itemsError } = await supabase.from('ordenes_compra_items').select('*').limit(3);
  if (itemsError) {
    console.error('Error fetching ordenes_compra_items:', itemsError);
  } else {
    console.log('ordenes_compra_items count:', itemsData.length);
    if (itemsData.length > 0) {
      console.log('Columns in ordenes_compra_items:', Object.keys(itemsData[0]));
      console.log('Sample item:', itemsData[0]);
    }
  }
}

run();
