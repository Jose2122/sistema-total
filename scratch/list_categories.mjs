import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '').replace('\r', '');
    env[k] = v;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function listCats() {
  const { data: clasifs } = await supabase.from('maestros_clasificaciones').select('*');
  const { data: subclasifs } = await supabase.from('maestros_sub_clasificaciones').select('*');
  console.log('=== CLASIFICACIONES ===');
  console.log((clasifs || []).map(c => c.nombre));
  console.log('\n=== SUB CLASIFICACIONES / CATEGORIAS ===');
  console.log((subclasifs || []).map(s => s.nombre));
}

listCats();
