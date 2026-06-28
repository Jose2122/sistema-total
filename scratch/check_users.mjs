import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkUsers() {
  const { data, error } = await supabase.from('perfiles').select('id, nombre, apellido, rol, correo');
  if (error) {
    console.error("Error fetching profiles:", error);
  } else {
    console.log("Profiles found:", data);
  }
}

checkUsers();
