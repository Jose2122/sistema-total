const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  try {
    const { data, error } = await supabase
      .from('requisiciones')
      .select('*')
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) {
      console.log('COLUMNS:', Object.keys(data[0]));
      console.log('SAMPLE ROW:', JSON.stringify(data[0], null, 2));
    } else {
      console.log('No rows found in requisiciones');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}
check();
