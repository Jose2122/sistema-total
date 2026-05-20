const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) { process.env[k] = envConfig[k]; }
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log("--- DISTINCT REQUISICIONES GERENCIA ---");
  const { data: reqs, error: rError } = await supabase.from('requisiciones').select('gerencia');
  if (rError) console.error(rError);
  else {
    const depts = [...new Set(reqs.map(r => r.gerencia))];
    console.log(depts);
  }

  console.log("--- DISTINCT SOLICITUDES_FONDOS GERENCIA_NOMBRE ---");
  const { data: sf, error: sfError } = await supabase.from('solicitudes_fondos').select('gerencia_nombre');
  if (sfError) console.error(sfError);
  else {
    const depts = [...new Set(sf.map(s => s.gerencia_nombre))];
    console.log(depts);
  }
}

check();
