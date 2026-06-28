import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://pugwgdqgsqjtbeouodpo.supabase.co";
const supabaseAnonKey = "sb_publishable_oBdXZE0PPSnj9lv-1qzalA_uB6kHtVu";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findCarlos() {
  console.log("Searching for Carlos Vega...");
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .or('correo.ilike.cvega%,nombre.ilike.carlos%');

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Found perfiles:", JSON.stringify(data, null, 2));
  }
}

findCarlos();
