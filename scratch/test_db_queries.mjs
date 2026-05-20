import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("Fetching tickets_directos count...");
  const { count, error: countErr } = await supabase
    .from('tickets_directos')
    .select('*', { count: 'exact', head: true });
  
  if (countErr) {
    console.error("Error fetching count:", countErr);
    return;
  }
  console.log("Total tickets_directos:", count);

  console.log("Creating a temporary test ticket...");
  const testId = "99999999-9999-9999-9999-999999999999";
  
  // First clean up in case it exists
  await supabase.from('tickets_directos').delete().eq('id', testId);

  const { data: inserted, error: insertErr } = await supabase
    .from('tickets_directos')
    .insert([
      {
        id: testId,
        codigo_control: "TEST-DELETE-001",
        gerente_nombre: "TEST USER",
        departamento: "Administración General",
        status: "Emitido",
        monto: 100,
        items: []
      }
    ])
    .select();

  if (insertErr) {
    console.error("Error inserting test ticket:", insertErr);
    return;
  }
  console.log("Inserted test ticket:", inserted[0]?.id);

  console.log("Attempting to delete the test ticket...");
  const { error: deleteErr } = await supabase
    .from('tickets_directos')
    .delete()
    .eq('id', testId);

  if (deleteErr) {
    console.error("Error deleting test ticket (with service role):", deleteErr);
  } else {
    console.log("Successfully deleted test ticket with service role!");
  }
}

run();
