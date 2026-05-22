const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  try {
    const { data, error } = await supabase
      .from('requisicion_logs')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(10);
    if (error) throw error;
    console.log('RECENT LOGS:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
}
check();
