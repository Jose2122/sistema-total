const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) { process.env[k] = envConfig[k]; }
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: tickets, error } = await supabase
    .from('tickets_directos')
    .select('id, codigo_control, factura_url')
    .limit(5);

  if (error) {
    console.error("Error:", error);
  } else {
    for (const t of tickets) {
      console.log(`Ticket ID: ${t.id}, Code: ${t.codigo_control}`);
      console.log(`factura_url raw:`, t.factura_url);
      console.log(`factura_url type:`, typeof t.factura_url);
      if (typeof t.factura_url === 'string') {
        try {
          console.log(`parsed:`, JSON.parse(t.factura_url));
        } catch (e) {
          console.log(`Failed to parse:`, e.message);
        }
      }
      console.log('---');
    }
  }
}

check();
