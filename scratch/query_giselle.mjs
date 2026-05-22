import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Fetching Giselle's profile...");
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, rol, departamento, obras_asignadas')
    .ilike('nombre', '%Giselle%');
  
  if (error) {
    console.error("Error fetching Giselle's profile:", error);
    return;
  }
  console.log("Giselle's Profile:", JSON.stringify(data, null, 2));
}

run();
