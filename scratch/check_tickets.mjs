import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTickets() {
    console.log("--- DIAGNÓSTICO DE TICKETS ---");
    const { data, error } = await supabase.from('tickets_directos').select('*').limit(5);
    if (error) {
        console.error("Error fetching tickets:", error);
        return;
    }
    console.log(`Tickets encontrados: ${data.length}`);
    if (data.length > 0) {
        console.log("Columnas:", Object.keys(data[0]));
        console.table(data.map(t => ({
            id: t.id,
            codigo: t.codigo_control,
            gerente: t.gerente_nombre,
            status: t.status,
            total: t.total_usd
        })));
    } else {
        console.log("No hay tickets en la tabla.");
    }
}

checkTickets();
