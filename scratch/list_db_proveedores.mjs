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

async function listAllDbProveedores() {
  const { data, error } = await supabase.from('proveedores').select('*');
  console.log(`Total proveedores in DB: ${data ? data.length : 0}`);
  if (error) console.error("Error:", error);
  if (data) {
    data.forEach(p => {
      console.log(`[ID: ${p.id}] ${p.razon_social} | RIF: ${p.rif} | Contacto: ${p.persona_contacto} | Tel: ${p.telefono} | Correo: ${p.correo}`);
    });
  }
}

listAllDbProveedores();
