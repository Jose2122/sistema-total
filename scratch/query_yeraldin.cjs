const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) { process.env[k] = envConfig[k]; }
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log("--- PERFILES ---");
  const { data: perfiles, error: pError } = await supabase.from('perfiles').select('*').ilike('nombre', '%yeraldin%');
  if (pError) console.error(pError);
  else console.log(JSON.stringify(perfiles, null, 2));

  console.log("--- TICKETS DIRECTOS COUNT ---");
  const { count, error: tError } = await supabase.from('tickets_directos').select('*', { count: 'exact', head: true });
  if (tError) console.error(tError);
  else console.log("Total tickets in DB:", count);

  console.log("--- RECENT TICKETS ---");
  const { data: tickets, error: tListError } = await supabase.from('tickets_directos').select('id, codigo_control, gerente_nombre, departamento, status').limit(5);
  if (tListError) console.error(tListError);
  else console.log(JSON.stringify(tickets, null, 2));
}

check();
