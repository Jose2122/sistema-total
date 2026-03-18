import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  try {
    const { data: perfiles } = await supabase.from('perfiles').select('*');
    console.log('--- PERFILES ---');
    console.log(JSON.stringify(perfiles, null, 2));

    const { data: solicitudes } = await supabase.from('solicitudes_fondos').select('*').order('created_at', { ascending: false }).limit(5);
    console.log('--- SOLICITUDES ---');
    console.log(JSON.stringify(solicitudes.map(s => ({ id: s.codigo_control, resp: s.responsable_nombre, ger: s.gerencia_nombre })), null, 2));
  } catch (e) {
    console.error(e);
  }
}

check();
