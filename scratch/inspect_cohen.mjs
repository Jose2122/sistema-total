import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("=== INSPECTING JOSE COHEN CC ===");
  // Buscar el centro de costo
  const { data: ccs, error: ccError } = await supabase
    .from('maestros_centros_costo')
    .select('id, nombre, activo')
    .ilike('nombre', '%Cohen%');

  if (ccError) {
    console.error("Error fetching centros costo:", ccError);
    return;
  }

  console.log("Centros de costo encontrados:", ccs);

  for (const cc of ccs) {
    // Clasificaciones
    const { data: clasifs, error: clError } = await supabase
      .from('maestros_clasificaciones')
      .select('id, nombre, activo')
      .eq('centro_costo_id', cc.id);

    if (clError) {
      console.error(`Error fetching clasificaciones for ${cc.nombre}:`, clError);
      continue;
    }

    console.log(`\nCentro de Costo: ${cc.nombre} (ID: ${cc.id})`);
    console.log(`Total clasificaciones: ${clasifs.length}`);

    // Mostrar las primeras 5 clasificaciones y ver cuántas categorías tienen
    let totalCategorias = 0;
    for (const cl of clasifs) {
      const { count, error: countError } = await supabase
        .from('maestros_sub_clasificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('clasificacion_id', cl.id);
      
      if (!countError) {
        totalCategorias += count || 0;
      }
    }
    console.log(`Total subclasificaciones (categorías) asociadas: ${totalCategorias}`);
    
    if (clasifs.length > 0) {
      console.log("Algunas clasificaciones:");
      console.log(clasifs.slice(0, 10).map(c => `- ${c.nombre} (activo: ${c.activo})`).join('\n'));
    }
  }
}

run();
