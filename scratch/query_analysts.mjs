import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Fetching all profiles under Operaciones...");
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, apellido, rol, departamento, obras_asignadas, activo')
    .eq('departamento', 'Operaciones');
  
  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }
  console.log("Profiles in Operaciones:", JSON.stringify(data, null, 2));
}

run();
