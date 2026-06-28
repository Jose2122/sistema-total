import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Fetching 5 most recent requisitions...");
  const { data, error } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, solicitante, gerencia, centro_costo, estado_aprobacion, aprobacion_nombre, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error("Error fetching requisitions:", error);
    return;
  }
  console.log("Recent Requisitions:", JSON.stringify(data, null, 2));
}

run();
