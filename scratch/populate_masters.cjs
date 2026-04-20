const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const centrosCosto = [
  { id: 1, nombre: 'Cam Vacío Boscan' },
  { id: 2, nombre: 'Mtto May Bajo G' },
  { id: 3, nombre: 'Excelencia Ops' },
  { id: 4, nombre: 'Cam Vacío Bajo G' },
  { id: 5, nombre: 'Proyectos Menores' },
  { id: 6, nombre: 'Suc. El Tigre' },
  { id: 7, nombre: 'Ofi. Ppal. Mcbo' },
  { id: 8, nombre: 'Bonificación Socios' },
  { id: 9, nombre: 'Suc. Campo Boscan' }
];

const clasificacionesTemplate = [
  {
    nombre: 'Materiales',
    categorias: ['Materiales Instalables', 'Materiales Consumibles', 'Fletes']
  },
  {
    nombre: 'Depreciación de Equipos',
    categorias: ['Depreciación Eq.']
  },
  {
    nombre: 'Equipos Propios',
    categorias: [
      'Gasoil', 'Gasolina', 'Aceites', 'Refrigerante', 'Grasa', 
      'Baterías', 'Cauchos', 'Reparación de Cauchos', 'Filtros', 
      'Gamusa', 'Reparaciones/Repuestos', 'Reparaciones/Mano de Obra', 
      'Monitoreo GPS'
    ]
  }
];

async function run() {
  console.log('--- Iniciando Población de Maestros ---');

  for (const cc of centrosCosto) {
    console.log(`\nProcesando Centro de Costo: ${cc.nombre} (ID: ${cc.id})`);

    for (const cTemplate of clasificacionesTemplate) {
      // 1. Insertar o encontrar Clasificación
      // Usamos upsert por si acaso, aunque la instrucción es poblar.
      // Para evitar duplicados en esta corrida, buscamos primero.
      let { data: clasifExistente } = await supabase
        .from('maestros_clasificaciones')
        .select('id')
        .eq('centro_costo_id', cc.id)
        .eq('nombre', cTemplate.nombre)
        .maybeSingle();

      let clasifId;
      if (clasifExistente) {
        clasifId = clasifExistente.id;
        console.log(`  - Clasificación "${cTemplate.nombre}" ya existe (ID: ${clasifId})`);
      } else {
        const { data: nuevaClasif, error: errC } = await supabase
          .from('maestros_clasificaciones')
          .insert([{ 
            centro_costo_id: cc.id, 
            nombre: cTemplate.nombre, 
            activo: true 
          }])
          .select()
          .single();
        
        if (errC) {
          console.error(`  - Error creando clasif "${cTemplate.nombre}":`, errC.message);
          continue;
        }
        clasifId = nuevaClasif.id;
        console.log(`  - Clasificación "${cTemplate.nombre}" creada (ID: ${clasifId})`);
      }

      // 2. Insertar Categorías
      for (const catNombre of cTemplate.categorias) {
        let { data: catExistente } = await supabase
          .from('maestros_sub_clasificaciones')
          .select('id')
          .eq('clasificacion_id', clasifId)
          .eq('nombre', catNombre)
          .maybeSingle();

        if (catExistente) {
          console.log(`    * Categoría "${catNombre}" ya existe.`);
        } else {
          const { error: errS } = await supabase
            .from('maestros_sub_clasificaciones')
            .insert([{ 
              clasificacion_id: clasifId, 
              nombre: catNombre, 
              activo: true 
            }]);
          
          if (errS) {
            console.error(`    * Error creando categoría "${catNombre}":`, errS.message);
          } else {
            console.log(`    * Categoría "${catNombre}" creada.`);
          }
        }
      }
    }
  }

  console.log('\n--- Población Finalizada ---');
}

run();
