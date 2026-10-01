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

async function find() {
  const { data: reqs } = await supabase.from('requisiciones').select('items');
  const searchTerms = ['03684176', 'MEGA SERVICE', 'YENDIZ', 'JULIO RICO', 'KARIBBEAN', 'GUAYAS'];
  
  reqs.forEach(r => {
    (r.items || []).forEach(it => {
      (it.historial_compras || []).forEach(h => {
        searchTerms.forEach(term => {
          if (JSON.stringify(h).toUpperCase().includes(term)) {
            console.log(`Found ${term}:`, h);
          }
        });
      });
    });
  });
}

find();
