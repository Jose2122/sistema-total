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

async function verifyBatch4() {
  const { data, error } = await supabase
    .from('requisiciones')
    .select('items')
    .eq('correlativo_req', 'SYS-PROVEEDORES-CENTRAL')
    .single();

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  const provs = data.items[0].proveedores;
  console.log(`\n========================================`);
  console.log(` TOTAL PROVEEDORES EN NUBE: ${provs.length}`);
  console.log(`========================================\n`);

  const list = [
    'FERRETERIA CLEMA',
    'FERRETERIA ROCCA',
    'FERRETERIA RONACA',
    'FILTROS Y LUBRICANTES EL PUENTE',
    'FABIO DE CASTRO',
    'FABRIEMPACUES',
    'FARMAEXPRESS C.A',
    'FARMAEXPRESS C2',
    'FARMATODO',
    'FAVEMOCA',
    'EMPRESA NACIONAL DE MECANICA',
    'EMNAMECA',
    'ENARGER',
    'EQUIPAMIENTO TECNOLOGICO',
    'ESNELL SIFONTES',
    'EURO ENRIQUE GONZALEZ',
    'DON JUAN MULTISERVICIOS',
    'DOUGLAS ENRIQUE MORAN',
    'EFA SISTEMAS',
    'EL FOGON CRIOLLO',
    'ELCA TELECOMUNICACIONES',
    'ELECTRO SERVICIOS GUAYANA',
    'EMBRAGUES Y BOMBAS ZULIA',
    'COMPRESORES EL 4',
    'CONSTRUCTORA OMP',
    'COPCENTER LA POPULAR',
    'DAKA',
    'DALIA JOSEFINA HERRERA',
    'DENNIS RAMIREZ MACHADO'
  ];

  list.forEach(name => {
    const found = provs.find(p => 
      (p.razon_social || '').toUpperCase().includes(name.toUpperCase()) ||
      (p.persona_contacto || '').toUpperCase().includes(name.toUpperCase())
    );
    if (found) {
      console.log(`✅ [${found.rif || 'Sin RIF'}] ${found.razon_social} | Contacto: ${found.persona_contacto || 'Sin contacto'} | Tel: ${found.telefono || 'Sin tel'} | Loc: ${found.ciudad || found.localizacion}`);
    } else {
      console.log(`❌ NO ENCONTRADO: ${name}`);
    }
  });
}

verifyBatch4();
