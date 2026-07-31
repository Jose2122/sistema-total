import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://pugwgdqgsqjtbeouodpo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Z3dnZHFnc3FqdGJlb3VvZHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDUwMjcsImV4cCI6MjA4ODIyMTAyN30.8LZ1Oe8a-aKr3WeFH7PfXpo8SGXhEKL6vCKbo_JJNvo"
);

async function run() {
  const { data, error } = await supabase
    .from('perfiles')
    .select('*');
  if (error) {
    console.error(error);
  } else {
    console.log(data.map(p => ({
      id: p.id,
      nombre: p.nombre,
      apellido: p.apellido,
      correo: p.correo,
      rol: p.rol,
      departamento: p.departamento
    })));
  }
}
run();
