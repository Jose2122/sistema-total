import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Fetching all profiles...");
  const { data: perfiles, error } = await supabase
    .from('perfiles')
    .select('*');
  
  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  console.log("Total profiles:", perfiles?.length);
  
  const targetEmails = [
    'jcontreras.totalclean@gmail.com',
    'karincmm1@gmail.com',
    'cvega@totalclean.com',
    'cvega.totalclean@gmail.com'
  ];

  perfiles.forEach(p => {
    const email = p.correo || '';
    if (targetEmails.includes(email.toLowerCase()) || p.rol?.toLowerCase().includes('admin')) {
      console.log(`Profile: ${p.nombre} ${p.apellido} (${p.correo})`);
      console.log(JSON.stringify(p, null, 2));
      console.log("-----------------------------------------");
    }
  });
}

run();
