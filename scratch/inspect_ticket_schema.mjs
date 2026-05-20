import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Fetching one ticket to inspect keys...");
  const { data, error } = await supabase
    .from('tickets_directos')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching ticket:", error);
    return;
  }

  if (data && data.length > 0) {
    console.log("Columns in tickets_directos:", Object.keys(data[0]));
    console.log("Sample ticket:", JSON.stringify(data[0], null, 2));
  } else {
    console.log("No tickets found.");
  }
}

run();
