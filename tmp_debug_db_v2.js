const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) { process.env[k] = envConfig[k]; }
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('requisiciones').select('*').limit(1);
  if (error) console.error(error);
  else if (data && data.length > 0) console.log(JSON.stringify(Object.keys(data[0]), null, 2));
  else console.log("No rows found in requisiciones");
}

check();
