import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, solicitante, estado_aprobacion, gerencia, centro_costo')
    .ilike('solicitante', '%Nayje%');

  if (error) {
    console.error(error);
    return;
  }

  console.log("Requisiciones de Nayje:");
  console.table(data);
}

check();
