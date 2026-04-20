const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) { process.env[k] = envConfig[k]; }
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('--- USUARIOS DE SEGURIDAD ---');
  const { data: users } = await supabase.from('perfiles').select('nombre, correo, rol, departamento').ilike('departamento', '%Seguridad%');
  console.log(JSON.stringify(users, null, 2));

  console.log('\n--- REQUISICIONES (Últimas 5) ---');
  const { data: reqs } = await supabase.from('requisiciones').select('id, solicitante, gerencia, departamento').order('created_at', { ascending: false }).limit(5);
  console.log(JSON.stringify(reqs, null, 2));

  console.log('\n--- SOLICITUDES DE FONDO (Últimas 5) ---');
  const { data: sf } = await supabase.from('solicitudes_fondos').select('id, responsable_nombre, gerencia_nombre').order('created_at', { ascending: false }).limit(5);
  console.log(JSON.stringify(sf, null, 2));
}

check();
