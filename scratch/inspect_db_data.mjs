import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://pugwgdqgsqjtbeouodpo.supabase.co";
const supabaseAnonKey = "sb_publishable_oBdXZE0PPSnj9lv-1qzalA_uB6kHtVu";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  // Login first
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'cvega@totalclean.com',
    password: '123456'
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }
  console.log("Logged in successfully!");

  // Fetch all cat_gerencias
  const { data: gerencias, error: gError } = await supabase
    .from('cat_gerencias')
    .select('*')
    .order('nombre');

  if (gError) {
    console.error("Error fetching gerencias:", gError.message);
  } else {
    console.log("--- GERENCIAS ---");
    console.log(JSON.stringify(gerencias, null, 2));
  }

  // Fetch Carlos Vega's profiles (we know his email or ID)
  const { data: profiles, error: pError } = await supabase
    .from('perfiles')
    .select('*')
    .or('correo.ilike.cvega%');

  if (pError) {
    console.error("Error fetching Carlos Vega's profiles:", pError.message);
  } else {
    console.log("--- CARLOS VEGA PROFILES ---");
    console.log(JSON.stringify(profiles, null, 2));
  }
}

inspect();
