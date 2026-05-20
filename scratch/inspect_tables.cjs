const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  try {
    const { data: bData, error: bError } = await supabase.from('bancos').select('*').limit(5);
    console.log("Bancos rows:", bData?.length, bError?.message || "");
    if (bData && bData.length > 0) {
      console.log("Bancos sample:", bData[0]);
    }

    const { data: tData, error: tError } = await supabase.from('tickets_directos').select('*').limit(5);
    console.log("Tickets rows:", tData?.length, tError?.message || "");
    if (tData && tData.length > 0) {
      console.log("Tickets sample:", tData[0]);
    }
  } catch (e) {
    console.error("Error fatal:", e.message);
  }
}
check();
