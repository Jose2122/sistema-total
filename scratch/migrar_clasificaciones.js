
import { createClient } from '@supabase/supabase-api';
// Usamos los valores persistentes del sistema para conectar
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrarClasificaciones() {
  console.log('--- INICIANDO MIGRACIÓN DE CLASIFICACIONES ---');
  
  // 1. Obtener todos los centros de costo maestros
  const { data: centrosCosto } = await supabase.from('maestros_centros_costo').select('id, nombre');
  
  // 2. Obtener todas las clasificaciones actuales
  const { data: clasificaciones } = await supabase.from('maestros_clasificaciones').select('*');
  
  console.log(`Encontrados ${centrosCosto.length} Centros de Costo y ${clasificaciones.length} Clasificaciones.`);

  let actualizados = 0;
  let errores = 0;

  for (const clasif of clasificaciones) {
    // Buscar el ID del centro de costo usando el nombre de texto actual
    const padre = centrosCosto.find(cc => cc.nombre === clasif.maestros_centros_costo);
    
    if (padre) {
      const { error } = await supabase
        .from('maestros_clasificaciones')
        .update({ id_centro_costo: padre.id })
        .eq('id', clasif.id);
        
      if (!error) {
        actualizados++;
      } else {
        console.error(`Error actualizando ID ${clasif.id}:`, error.message);
        errores++;
      }
    } else {
      console.warn(`No se encontró padre para clasif: "${clasif.nombre}" (Texto: ${clasif.maestros_centros_costo})`);
    }
  }

  console.log(`--- MIGRACIÓN FINALIZADA ---`);
  console.log(`Exitosos: ${actualizados}`);
  console.log(`Errores: ${errores}`);
}

migrarClasificaciones();
