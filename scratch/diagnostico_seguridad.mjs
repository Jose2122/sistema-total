import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function diagnostico() {
    console.log("--- DIAGNÓSTICO DE ESTRUCTURA ---");

    // 1. Departamentos
    const { data: gerencias } = await supabase.from('cat_gerencias').select('id, nombre');
    console.log(`Departamentos existentes (${gerencias?.length || 0}):`, gerencias?.map(g => g.nombre).join(', '));

    // 2. Usuarios por Rol y Departamento
    const { data: usuarios } = await supabase.from('perfiles').select('id, nombre, rol, departamento');
    
    const resumen = {};
    usuarios?.forEach(u => {
        const depto = u.departamento || 'Sin Departamento';
        if (!resumen[depto]) resumen[depto] = { Analista: 0, Gerente: 0, Coordinador: 0, Otros: 0 };
        
        const rol = u.rol || 'Otros';
        if (rol.includes('Analista')) resumen[depto].Analista++;
        else if (rol.includes('Gerente')) resumen[depto].Gerente++;
        else if (rol.includes('Coordinador')) resumen[depto].Coordinador++;
        else resumen[depto].Otros++;
    });

    console.log("\nDesglose por Departamento y Rol:");
    console.table(resumen);
}

diagnostico();
