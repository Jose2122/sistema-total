import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testQuery() {
    // 1. Simular un usuario (por ejemplo Jarlen)
    const currentUser = {
        id: "algo",
        nombre: "Jarlen",
        rol: "Analista",
        departamento: "Operaciones"
    };

    let query = supabase.from('requisiciones').select('id, correlativo_req, solicitante, gerencia, user_id');

    const rolUserLower = (currentUser.rol || '').toLowerCase();
    const deptoMatch = currentUser.departamento;
    const userIdMatch = currentUser.id || '00000000-0000-0000-0000-000000000000';
    const nombreMatch = (currentUser.nombre || '').split(' ')[0] || 'Unknown';

    if (rolUserLower.includes('analista')) {
        query = query.or(`user_id.eq.${userIdMatch},solicitante.ilike.%${nombreMatch}%`);
    } else if (rolUserLower.includes('gerente') || rolUserLower.includes('coordinador')) {
        if (deptoMatch) {
            query = query.ilike('gerencia', `%${deptoMatch}%`);
        } else {
            query = query.or(`user_id.eq.${userIdMatch},solicitante.ilike.%${nombreMatch}%`);
        }
    }

    const { data, error } = await query.limit(5);
    console.log("Analista Query Data:", data ? data.length : null);
    console.log("Analista Error:", error);

    // Simular un Gerente
    const currentUserGerente = {
        id: "algo2",
        nombre: "Wilmer",
        rol: "Gerente",
        departamento: "Operaciones"
    };
    
    let query2 = supabase.from('requisiciones').select('id, correlativo_req, solicitante, gerencia, user_id');
    const rol2 = currentUserGerente.rol.toLowerCase();
    const depto2 = currentUserGerente.departamento;
    if (depto2) {
        query2 = query2.ilike('gerencia', `%${depto2}%`);
    }
    const { data: data2, error: error2 } = await query2.limit(5);
    console.log("Gerente Query Data:", data2 ? data2.length : null);
    console.log("Gerente Error:", error2);

}

testQuery();
