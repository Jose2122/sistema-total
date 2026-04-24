import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRLS() {
    console.log("Checking if RLS is enabled...");
    // We can't directly read pg_class via anon key, but we can try to insert or select.
    // If we get data, RLS allows reading.
    const { data, error } = await supabase.from('requisiciones').select('id').limit(1);
    console.log("Data:", data);
    console.log("Error:", error);
}

checkRLS();
