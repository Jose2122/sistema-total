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

const exactNames = {
  'J-07010322-1': 'REGINA GAS C.A',
  'J-50591702-1': 'OXIGENOS ELY ACOSTA 2024,C.A.',
  'J-40690539-9': 'MULTISERVICIOS DANY & MANUEL C.A.',
  'V-30358687-0': 'MEGA SERVICE 1122',
  'V-20992211-0': 'JOSE YENDIZ',
  'J-31113105-1': 'KARIBBEAN, C.A',
  'J-50687412-1': 'LA CASA DE LAS GUAYAS 2025 C.A'
};

async function fixBatch2Names() {
  const { data } = await supabase
    .from('requisiciones')
    .select('id, items')
    .eq('correlativo_req', 'SYS-PROVEEDORES-CENTRAL')
    .single();

  const provs = data.items[0].proveedores;
  provs.forEach(p => {
    if (exactNames[p.rif]) {
      p.razon_social = exactNames[p.rif];
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

  console.log('Batch 2 names fixed!');
}

fixBatch2Names();
