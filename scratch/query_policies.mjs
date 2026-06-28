import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Querying pg_policies using service role key...");
  const { data, error } = await supabase
    .from('pg_policies')
    .select('*');
  
  if (error) {
    console.error("Failed to query pg_policies:", error);
  } else {
    console.log("Successfully queried pg_policies! Policies:", data);
  }
}

run();
