const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pugwgdqgsqjtbeouodpo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Z3dnZHFnc3FqdGJlb3VvZHBvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY0NTAyNywiZXhwIjoyMDg4MjIxMDI3fQ.3NQ6sRfIrUHyWkdOYnKIhsKbjf-qr9V4ZFY_F2-e5do';

const supabase = createClient(supabaseUrl, supabaseKey);

const gerencias = [
  { nombre: "Mantenimiento", abr: "MTTO" },
  { nombre: "Operaciones", abr: "OPE" },
  { nombre: "Recursos Humanos", abr: "RRHH" },
  { nombre: "Estimación y Control Interno", abr: "ECI" },
  { nombre: "Servicios Generales", abr: "SSGG" },
  { nombre: "Compras", abr: "CMP" },
  { nombre: "Administración Maracaibo", abr: "ADM" },
  { nombre: "Seguridad", abr: "SEG" }
];

async function populate() {
  console.log("Populating cat_gerencias...");
  for (const item of gerencias) {
    try {
      const { data, error } = await supabase
        .from('cat_gerencias')
        .select('id')
        .eq('nombre', item.nombre)
        .maybeSingle();

      if (error) {
        console.error(`Error checking ${item.nombre}:`, error.message);
        continue;
      }

      if (!data) {
        const { error: insError } = await supabase
          .from('cat_gerencias')
          .insert([{ nombre: item.nombre, abreviatura: item.abr }]);
        
        if (insError) {
          console.error(`Error inserting ${item.nombre}:`, insError.message);
        } else {
          console.log(`Successfully inserted: ${item.nombre}`);
        }
      } else {
        console.log(`Already exists: ${item.nombre}`);
      }
    } catch (e) {
      console.error(`Fatal error with ${item.nombre}:`, e.message);
    }
  }
}

populate();
