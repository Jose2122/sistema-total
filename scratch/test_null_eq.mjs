import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Testing .eq('gerencia_id', null) query...");
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('gerencia_id', null)
    .neq('id', '3a7d59f9-1960-400d-a0e0-33fefc596bcf');

  console.log("Error:", error);
  console.log("Data count:", data?.length);
}

run();
