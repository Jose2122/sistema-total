import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Fetching Solicitud de Fondos RRH-SEM 21-26...");
  const { data, error } = await supabase
    .from('solicitudes_fondos')
    .select('*')
    .eq('id', 'RRH-SEM 21-26');
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("SF Data:", JSON.stringify(data[0], null, 2));
}

run();
