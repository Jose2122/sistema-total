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

async function check() {
  const { data: pDb, error: err1 } = await supabase.from('proveedores').select('*');
  console.log('Proveedores en tabla proveedores count:', pDb?.length, 'error:', err1?.message);
  const foundDb = (pDb || []).filter(p => JSON.stringify(p).toUpperCase().includes('TECHNOLOGY') || JSON.stringify(p).includes('40282085'));
  console.log('Encontrados en tabla proveedores:', JSON.stringify(foundDb, null, 2));

  const { data: syncReq, error: err2 } = await supabase.from('requisiciones').select('*').eq('correlativo_req', 'SYS-PROVEEDORES-CENTRAL');
  if (syncReq && syncReq[0]) {
    const list = syncReq[0].items[0].proveedores || [];
    console.log('Total en SYS-PROVEEDORES-CENTRAL:', list.length);
    const foundSync = list.filter(p => JSON.stringify(p).toUpperCase().includes('TECHNOLOGY') || JSON.stringify(p).includes('40282085'));
    console.log('Encontrados en lista SYS-PROVEEDORES-CENTRAL:', JSON.stringify(foundSync, null, 2));
    
    const hist = syncReq[0].items[0].historial_modificaciones || [];
    console.log('Historial en SYS-PROVEEDORES-CENTRAL count:', hist.length);
    const foundHist = hist.filter(h => JSON.stringify(h).toUpperCase().includes('TECHNOLOGY') || JSON.stringify(h).includes('40282085'));
    console.log('Encontrados en Historial SYS-PROVEEDORES-CENTRAL:', JSON.stringify(foundHist, null, 2));
  } else {
    console.log('SYS-PROVEEDORES-CENTRAL no existe o error:', err2?.message);
  }
}
check();
