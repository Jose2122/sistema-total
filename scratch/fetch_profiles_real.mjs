import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const credentials = [
  { email: 'jcontreras.totalclean@gmail.com', password: '123456' },
  { email: 'cvega.totalclean@gmail.com', password: '123456' },
  { email: 'cvega@totalclean.com', password: '123456' },
  { email: 'karincmm1@gmail.com', password: '123456' },
  { email: 'jcontreras.totalclean@gmail.com', password: 'TotalClean123!' },
  { email: 'cvega@totalclean.com', password: 'TotalClean123!' }
];

async function run() {
  let loggedIn = false;
  for (const cred of credentials) {
    console.log(`Signing in as ${cred.email}...`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cred.email,
      password: cred.password
    });
    
    if (!authError) {
      console.log(`SUCCESS! Logged in as ${cred.email}`);
      loggedIn = true;
      break;
    } else {
      console.log(`Failed: ${authError.message}`);
    }
  }
  
  if (!loggedIn) {
    console.error("All logins failed.");
    return;
  }
  
  console.log("Fetching profiles...");
  const { data: profiles, error: pError } = await supabase
    .from('perfiles')
    .select('id, nombre, apellido, correo, rol, departamento, obras_asignadas, gerente_directo_id, gerente_directo_nombre')
    .limit(300);
    
  if (pError) {
    console.error("Error fetching profiles:", pError.message);
    return;
  }
  
  console.log(`Fetched ${profiles.length} profiles.`);
  
  const targets = ["zuleika", "rosa", "favio", "colina", "bavuso", "lara"];
  for (const p of profiles) {
    const fullName = `${p.nombre || ''} ${p.apellido || ''}`.toLowerCase();
    if (targets.some(t => fullName.includes(t) || (p.correo || '').toLowerCase().includes(t))) {
      console.log(JSON.stringify(p, null, 2));
      console.log("-".repeat(40));
    }
  }
}

run();
