import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Querying triggers on table 'requisiciones'...");
  const sql = `
    SELECT 
      trigger_name, 
      event_manipulation, 
      event_object_table, 
      action_statement, 
      action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'requisiciones';
  `;
  
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    console.error("Error querying triggers:", error);
    return;
  }
  console.log("Triggers:", JSON.stringify(data, null, 2));
}

run();
