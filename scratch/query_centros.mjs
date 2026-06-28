import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Fetching unique centro_costo from requisiciones...");
  const { data, error } = await supabase
    .from('requisiciones')
    .select('centro_costo')
    .limit(200);
  
  if (error) {
    console.error("Error fetching centro_costo:", error);
    return;
  }
  
  const ccs = [...new Set(data.map(d => d.centro_costo).filter(Boolean))];
  console.log("Unique centro_costo in requisiciones:", ccs);
}

run();
