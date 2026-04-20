const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pugwgdqgsqjtbeouodpo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Z3dnZHFnc3FqdGJlb3VvZHBvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY0NTAyNywiZXhwIjoyMDg4MjIxMDI3fQ.3NQ6sRfIrUHyWkdOYnKIhsKbjf-qr9V4ZFY_F2-e5do';

const supabase = createClient(supabaseUrl, supabaseKey);

const gerencias = [
  "Mantenimiento",
  "Operaciones",
  "Recursos Humanos",
  "Estimación y Control Interno",
  "Servicios Generales",
  "Compras",
  "Administración Maracaibo",
  "Seguridad"
];

async function populate() {
  console.log("Populating cat_gerencias...");
  for (const name of gerencias) {
    const { data, error } = await supabase
      .from('cat_gerencias')
      .select('id')
      .eq('nombre', name)
      .maybeSingle();

    if (error) {
      console.error(`Error checking ${name}:`, error.message);
      continue;
    }

    if (!data) {
      const { error: insError } = await supabase
        .from('cat_gerencias')
        .insert([{ nombre: name, activo: true }]);
      
      if (insError) {
        console.error(`Error inserting ${name}:`, insError.message);
      } else {
        console.log(`Successfully inserted: ${name}`);
      }
    } else {
      console.log(`Already exists: ${name}`);
    }
  }
}

populate();
