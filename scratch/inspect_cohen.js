import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

let envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  envPath = path.resolve('.env.local');
}
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

async function run() {
  console.log("Logging in as cvega@totalclean.com...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'cvega@totalclean.com',
    password: '123456'
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }
  console.log("Logged in successfully! Searching perfiles and solicitudes_fondos...");
  console.log("=== SEARCHING PERFILES FOR COHEN / JOSE ===");
  const { data: perfiles, error: pError } = await supabase
    .from('perfiles')
    .select('id, nombre, apellido, obras_asignadas, contrato, rol, departamento')
    .limit(100);

  if (pError) {
    console.error("Error fetching perfiles:", pError);
    return;
  }

  const matches = perfiles.filter(p => 
    (p.nombre && p.nombre.toLowerCase().includes('cohen')) ||
    (p.apellido && p.apellido.toLowerCase().includes('cohen')) ||
    (p.nombre && p.nombre.toLowerCase().includes('jose')) ||
    (p.apellido && p.apellido.toLowerCase().includes('jose'))
  );

  console.log(`Perfiles encontrados (${matches.length}):`);
  for (const p of matches) {
    console.log(`- ID: ${p.id}, Nombre: ${p.nombre} ${p.apellido}, Rol: ${p.rol}, Depto: ${p.departamento}, Obras:`, p.obras_asignadas, `, Contrato: "${p.contrato}"`);
  }
}

run();
