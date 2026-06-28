import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Fetching profiles containing 'Johannel' or 'García'...");
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, rol, departamento, obras_asignadas')
    .or("nombre.ilike.%Johannel%,nombre.ilike.%García%,nombre.ilike.%Garcia%");
  
  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }
  console.log("Profiles found:", JSON.stringify(data, null, 2));
}

run();
