import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://pugwgdqgsqjtbeouodpo.supabase.co";
const supabaseAnonKey = "sb_publishable_oBdXZE0PPSnj9lv-1qzalA_uB6kHtVu";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listAll() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'cvega@totalclean.com',
    password: '123456'
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }

  const { data: profiles, error: pError } = await supabase
    .from('perfiles')
    .select('id, nombre, apellido, correo, rol, departamento')
    .order('apellido');

  if (pError) {
    console.error("Error:", pError.message);
  } else {
    console.log("--- ALL PROFILES ---");
    profiles.forEach(p => {
      console.log(`${p.apellido}, ${p.nombre} (${p.correo}) - Rol: ${p.rol}, Depto: ${p.departamento}`);
    });
  }
}

listAll();
