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

async function test() {
  console.log("Testing direct select from storage.objects...");
  const { data, error } = await supabase
    .from('objects') // Wait, storage schema requires schema prefix.
    // In PostgREST, we can't easily query non-public schemas unless they are exposed in the search_path.
    // Let's test if 'storage.objects' works, or if 'objects' in public works.
    .select('*');
    
  if (error) {
    console.error("Direct objects query failed:", error.message);
  } else {
    console.log("Direct objects query succeeded! Count:", data.length);
  }
}
test();
