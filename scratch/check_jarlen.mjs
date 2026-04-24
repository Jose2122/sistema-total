import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkJarlen() {
    // 1. Buscar el perfil de Jarlen
    const { data: jarlen } = await supabase.from('perfiles').select('id, nombre, departamento').ilike('nombre', '%Jarlen%').single();
    console.log("Perfil de Jarlen:", jarlen);

    if (jarlen) {
        // 2. Buscar requisiciones donde Jarlen sea el solicitante o el user_id
        const { data: reqs, error } = await supabase
            .from('requisiciones')
            .select('id, correlativo_req, solicitante, user_id, departamento, gerencia')
            .or(`user_id.eq.${jarlen.id},solicitante.ilike.%Jarlen%`)
            .limit(5);
        
        console.log("Requisiciones encontradas para Jarlen:", reqs);
        if (error) console.error("Error en consulta:", error);
    }
}

checkJarlen();
