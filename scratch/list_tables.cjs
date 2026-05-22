const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  try {
    // List tables in public schema by executing a raw SQL query through Supabase using an RPC or inspection
    const { data, error } = await supabase
      .from('perfiles')
      .select('id')
      .limit(1);
    
    // We can list tables by querying postgres catalog.
    // Let's run a generic test or query if we can do custom RPC.
    // Since custom RPC might not exist, let's query the supabase API to see what tables are exposed.
    // The easiest way is to fetch the Swagger schema or request it.
    // But actually, let's write a script to try to select from 'auditoria' or 'logs' or similar common tables.
    // Let's see what happens if we list tables from information_schema.
    console.log('Fetching swagger schema to see all exposed tables...');
    const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/`;
    const response = await fetch(url, {
      headers: {
        'apikey': process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
      }
    });
    const schema = await response.json();
    console.log('Tables exposed in API:', Object.keys(schema.paths).map(p => p.split('/')[1]).filter((v, i, a) => v && a.indexOf(v) === i));
  } catch (e) {
    console.error('Error:', e.message);
  }
}
check();
