import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Fetching profiles for Johannel and Hilda...");
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, apellido, rol, departamento, obras_asignadas, activo')
    .or("nombre.ilike.%Hilda%,nombre.ilike.%Johannel%");
  
  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }
  console.log("Profiles found:", JSON.stringify(data, null, 2));
}

run();
