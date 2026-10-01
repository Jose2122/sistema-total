import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '').replace('\r', '');
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('proveedores').select('*').order('id', { ascending: true });
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Total registros en proveedores Supabase:', data.length);
  const conRif = data.filter(p => p.rif && p.rif.trim());
  console.log('Con RIF no vacío:', conRif.length);
  console.log('Sin RIF o vacío:', data.length - conRif.length);
  
  console.log('\n--- MUESTRA DE PROVEEDORES EN SUPABASE ---');
  console.table(data.map(p => ({
    id: p.id,
    razon_social: p.razon_social ? p.razon_social.substring(0, 30) : '—',
    rif: p.rif || '(VACÍO)',
    contacto: p.persona_contacto || p.contacto_nombre || '—',
    telefono: p.telefono || '—',
    ciudad: p.ciudad || p.localizacion || '—'
  })));
}

main();
