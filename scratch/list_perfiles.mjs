import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: perfiles } = await supabase.from('perfiles').select('*');
    console.log(`Total perfiles: ${perfiles?.length || 0}`);
    const matches = perfiles?.filter(p => 
      JSON.stringify(p).toLowerCase().includes('jarlen') ||
      JSON.stringify(p).toLowerCase().includes('administra')
    );
    console.log("Matching perfiles:", matches);
}

run();
