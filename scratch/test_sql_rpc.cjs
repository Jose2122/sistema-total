const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function testRPC() {
  const rpcNames = ['exec_sql', 'run_sql', 'execute_sql', 'sql'];
  for (const name of rpcNames) {
    try {
      console.log(`Testing RPC: ${name}...`);
      const { data, error } = await supabase.rpc(name, { query: 'SELECT 1;' });
      if (error) {
        console.log(`  Error: ${error.message} (code: ${error.code})`);
      } else {
        console.log(`  Success! RPC ${name} exists and returned:`, data);
        return name;
      }
    } catch (e) {
      console.log(`  Fatal: ${e.message}`);
    }
  }
  return null;
}

testRPC();
