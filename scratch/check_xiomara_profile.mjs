import { createClient } from '@supabase/supabase-js';

const url = "https://pugwgdqgsqjtbeouodpo.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Z3dnZHFnc3FqdGJlb3VvZHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDUwMjcsImV4cCI6MjA4ODIyMTAyN30.8LZ1Oe8a-aKr3WeFH7PfXpo8SGXhEKL6vCKbo_JJNvo";

const supabase = createClient(url, key);

async function listAllProfiles() {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, apellido, correo, rol, departamento, capacidades, delegacion_desde, delegacion_hasta');

  if (error) {
    console.error("Error listing profiles:", error);
  } else {
    console.log("Profiles found:", data);
  }
}

listAllProfiles();
