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

async function checkColumns() {
  const { data, error } = await supabase.from('notificaciones').select('*').limit(1);
  if (error) {
    console.error("Error fetching notification row:", error);
    return;
  }
  if (data && data.length > 0) {
    console.log("Found row. Keys:", Object.keys(data[0]));
  } else {
    // If empty, let's insert a test row to see columns
    console.log("No notification rows found. Querying using RPC or inspecting error...");
    const res = await supabase.from('notificaciones').insert([{
      usuario_id: '00000000-0000-0000-0000-000000000000',
      mensaje: 'test columns'
    }]).select();
    if (res.data && res.data.length > 0) {
      console.log("Inserted test row. Keys:", Object.keys(res.data[0]));
      // delete it
      await supabase.from('notificaciones').delete().eq('id', res.data[0].id);
    } else {
      console.log("Insert returned error or no data:", res.error);
    }
  }
}

checkColumns();
