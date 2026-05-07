import { createClient } from '@supabase/supabase-js';
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
  
  const toUpdate = data.filter(r => r.estado_aprobacion === 'pendiente_proyecto');
  if (toUpdate.length > 0) {
    console.log(`Actualizando ${toUpdate.length} requisiciones a pendiente_area...`);
    const { error: updError } = await supabase
      .from('requisiciones')
      .update({ estado_aprobacion: 'pendiente_area' })
      .in('id', toUpdate.map(r => r.id));
      
    if (updError) console.error(updError);
    else console.log("¡Actualización exitosa!");
  }
}

check();
