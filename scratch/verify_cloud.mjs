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

async function verifyAll() {
  const { data } = await supabase
    .from('requisiciones')
    .select('items')
    .eq('correlativo_req', 'SYS-PROVEEDORES-CENTRAL')
    .single();

  const provs = data.items[0].proveedores;
  console.log(`\n=== Total proveedores en nube: ${provs.length} ===`);

  const listToCheck = [
    { rif: 'V-18833392-6', nombre: 'WL DISEÑO & SUBLIMACION' },
    { rif: 'V-13830370-1', nombre: 'YOANNY JOSEFINA URDANETA BARRIOS' },
    { rif: 'V-24228215-0', nombre: 'ZULEIKA LARA' },
    { rif: 'J-07034507-1', nombre: 'UNIVERSIDAD RAFAEL BELLOSO CHACIN' },
    { rif: 'J-31149896-6', nombre: 'VALE CANJEABLE TICKETVEN, CA' },
    { rif: 'J-50171570-0', nombre: 'VENE-TRUCK' },
    { rif: 'J-29962835-2', nombre: 'VENTA DE MATERIALES E INSUMOS ELECTRICOS' },
    { rif: 'J-29525661-2', nombre: 'VIGILAME SERVICIOS INTEGRALES' },
    { rif: 'J-30702656-0', nombre: 'INVERSIONES LORUSSO, C.A.' },
    { rif: 'J-40431884-4', nombre: 'TRUMELTARCA' },
    { rif: 'J-40784553-5', nombre: 'SERVICIOS DE GRUAS RM C A' },
    { rif: 'J-31093193-3', nombre: 'SERVICIO MEDICO SANTA LUCIA' },
    { rif: 'J-40786547-1', nombre: 'SEGURIDAD TECNICA INDUSTRIAL ORIENTE C.A' },
    { rif: 'J-50792563-3', nombre: 'SERMAKOL' }
  ];

  listToCheck.forEach(item => {
    const core = item.rif.replace(/[^0-9]/g, '').substring(0, 8);
    const found = provs.find(p => (p.rif || '').replace(/[^0-9]/g, '').includes(core));
    if (found) {
      console.log(`✅ [${found.rif}] ${found.razon_social} | Contacto: ${found.persona_contacto || 'Sin contacto'} | Tel: ${found.telefono || 'Sin tel'} | Creador: ${found.creado_por_nombre || 'Analista'}`);
    } else {
      console.log(`❌ NO ENCONTRADO: ${item.rif} (${item.nombre})`);
    }
  });
}

verifyAll();
