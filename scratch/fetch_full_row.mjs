import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Fetching full row of RR-RRH-26-0006...");
  const { data, error } = await supabase
    .from('requisiciones')
    .select('*')
    .eq('correlativo_req', 'RR-RRH-26-0006');
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Full Row:", JSON.stringify(data[0], null, 2));
}

run();
