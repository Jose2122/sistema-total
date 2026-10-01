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

async function verify() {
  const { data } = await supabase
    .from('requisiciones')
    .select('items')
    .eq('correlativo_req', 'SYS-PROVEEDORES-CENTRAL')
    .single();

  const provs = data.items[0].proveedores;
  console.log(`\n=== Total proveedores en nube: ${provs.length} ===`);

  const list = [
    'J-07010322-1', 'J-31259448-9', 'J-30922116-7', 'J-50591702-1',
    'J-40891604-5', 'J-30539267-6', 'J-50381364-4', 'J-40690539-9',
    'J-31713732-9', 'V-39604368-0', 'V-30358687-0', 'J-50186970-7',
    'V-14279769-7', 'V-20992211-0', 'V-09920701-0', 'J-31113105-1',
    'J-50687412-1'
  ];

  list.forEach(rif => {
    const core = rif.replace(/[^0-9]/g, '').substring(0, 8);
    const found = provs.find(p => (p.rif || '').replace(/[^0-9]/g, '').includes(core));
    if (found) {
      console.log(`✅ [${found.rif}] ${found.razon_social} | Contacto: ${found.persona_contacto || 'Sin contacto'} | Tel: ${found.telefono || 'Sin tel'} | Ciudad: ${found.ciudad || found.localizacion}`);
    } else {
      console.log(`❌ NO ENCONTRADO: ${rif}`);
    }
  });
}

verify();
