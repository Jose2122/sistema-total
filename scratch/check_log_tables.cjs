const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const tables = ['requisicion_logs', 'historial_acciones', 'logs_actividad'];
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`Table ${table} error:`, error.message);
      } else if (data && data.length > 0) {
        console.log(`Table ${table} is active! Sample row:`, JSON.stringify(data[0], null, 2));
      } else {
        console.log(`Table ${table} is empty`);
      }
    } catch (e) {
      console.log(`Table ${table} exception:`, e.message);
    }
  }
}
check();
