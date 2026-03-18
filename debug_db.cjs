const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  try {
    const { data, error } = await supabase.from('solicitudes_fondos').select('*').limit(1);
    if (error) throw error;
    console.log(JSON.stringify(data[0], null, 2));
  } catch (e) {
    console.error(e.message);
  }
}
check();
