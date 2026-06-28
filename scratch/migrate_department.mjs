import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://pugwgdqgsqjtbeouodpo.supabase.co";
const supabaseAnonKey = "sb_publishable_oBdXZE0PPSnj9lv-1qzalA_uB6kHtVu";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runMigration() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'cvega@totalclean.com',
    password: '123456'
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }
  console.log("Logged in successfully!");

  // 1. Check if Dirección Corporativa already exists
  const { data: existing, error: findError } = await supabase
    .from('cat_gerencias')
    .select('*')
    .eq('nombre', 'Dirección Corporativa')
    .single();

  let gerenciaId = null;

  if (findError && findError.code !== 'PGRST116') { // PGRST116 is not found
    console.error("Error searching for department:", findError.message);
    return;
  }

  if (existing) {
    console.log("Department 'Dirección Corporativa' already exists with ID:", existing.id);
    gerenciaId = existing.id;
  } else {
    console.log("Inserting 'Dirección Corporativa'...");
    const { data: inserted, error: insertError } = await supabase
      .from('cat_gerencias')
      .insert({
        nombre: 'Dirección Corporativa',
        abreviatura: 'DC',
        activo: true
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting department:", insertError.message);
      return;
    }
    console.log("Successfully inserted department:", inserted);
    gerenciaId = inserted.id;
  }

  // 2. Update Carlos Vega's profile
  console.log("Updating Carlos Vega's profile with gerencia_id:", gerenciaId);
  const { data: updatedProfile, error: updateError } = await supabase
    .from('perfiles')
    .update({
      departamento: 'Dirección Corporativa',
      gerencia_id: gerenciaId
    })
    .eq('id', 'e3073b0d-f394-47ad-8adc-75f3d9aa6290')
    .select();

  if (updateError) {
    console.error("Error updating profile:", updateError.message);
  } else {
    console.log("Successfully updated Carlos Vega's profile:", updatedProfile);
  }
}

runMigration();
