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

async function fixNames() {
  const { data } = await supabase
    .from('requisiciones')
    .select('id, items')
    .eq('correlativo_req', 'SYS-PROVEEDORES-CENTRAL')
    .single();

  const provs = data.items[0].proveedores;
  provs.forEach(p => {
    if (p.rif === 'J-50171570-0') {
      p.razon_social = 'VENE-TRUCK';
      p.persona_contacto = 'VENE-TRUCK';
      p.contacto_nombre = 'VENE-TRUCK';
    }
    if (p.rif === 'J-40786547-1') {
      p.razon_social = 'SEGURIDAD TECNICA INDUSTRIAL ORIENTE C.A';
      p.persona_contacto = 'SEGURIDAD TECNICA';
      p.contacto_nombre = 'SEGURIDAD TECNICA';
    }
  });

  await supabase
    .from('requisiciones')
    .update({
      items: [{
        ...data.items[0],
        proveedores: provs,
        ultima_actualizacion: new Date().toISOString()
      }],
      updated_at: new Date().toISOString()
    })
    .eq('id', data.id);

  console.log('Names updated successfully!');
}

fixNames();
