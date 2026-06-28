import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Fetching one requisition to inspect keys...");
  const { data, error } = await supabase
    .from('requisiciones')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching requisition:", error);
    return;
  }

  if (data && data.length > 0) {
    console.log("Columns in requisiciones:", Object.keys(data[0]));
    console.log("Sample requisition:", JSON.stringify(data[0], null, 2));
  } else {
    console.log("No requisitions found.");
  }
}

run();
