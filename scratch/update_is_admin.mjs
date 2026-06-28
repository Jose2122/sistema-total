import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Updating perfiles to set is_admin = true for Super Administrators...");
  
  const targets = [
    'karincmm1@gmail.com',
    'cvega@totalclean.com',
    'cvega.totalclean@gmail.com'
  ];

  for (const email of targets) {
    const { data, error } = await supabase
      .from('perfiles')
      .update({ is_admin: true })
      .eq('correo', email)
      .select();

    if (error) {
      console.error(`Error updating ${email}:`, error);
    } else {
      console.log(`Successfully updated ${email}:`, data?.[0]?.nombre, "is_admin =", data?.[0]?.is_admin);
    }
  }
}

run();
