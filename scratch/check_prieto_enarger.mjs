import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = match[2].replace(/['"\r]/g, '').trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const credentials = [
  { email: 'jcontreras.totalclean@gmail.com', password: 'TotalClean123!' },
  { email: 'cvega@totalclean.com', password: 'TotalClean123!' },
  { email: 'jcontreras.totalclean@gmail.com', password: '123456' },
  { email: 'cvega@totalclean.com', password: '123456' }
];

async function test() {
  let loggedIn = false;
  for (const cred of credentials) {
    const { data, error } = await supabase.auth.signInWithPassword(cred);
    if (!error) {
      console.log(`Authenticated as ${cred.email}`);
      loggedIn = true;
      break;
    }
  }

  if (!loggedIn) {
    console.error("Could not log in with test credentials");
    return;
  }

  const { data: provs, error } = await supabase.from('proveedores').select('*');
  if (error) return console.error("Error fetching proveedores:", error);
  
  console.log('\n=== TABLA PROVEEDORES (DIRECTORIO) ===');
  console.log('Total registros en tabla proveedores:', provs.length);

  const prieto = provs.filter(p => p.razon_social?.toLowerCase().includes('prieto') || p.rif?.includes('PRIETO'));
  console.log('\nCoincidencias con PRIETO en tabla proveedores:', prieto);

  const enarger = provs.filter(p => p.razon_social?.toLowerCase().includes('enarg') || p.rif?.includes('ENARG'));
  console.log('\nCoincidencias con ENARGER en tabla proveedores:', enarger);

  // Check how many have rif null or empty
  const sinRif = provs.filter(p => !p.rif || p.rif === 'N/A' || p.rif.trim() === '');
  console.log(`\nProveedores en tabla sin RIF (o RIF N/A): ${sinRif.length} de ${provs.length}`);
  sinRif.forEach(p => console.log(`- ID: ${p.id} | ${p.razon_social}`));
}

test();
