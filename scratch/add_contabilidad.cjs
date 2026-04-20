const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
  const envText = fs.readFileSync('.env.local', 'utf8');
  const urlMatch = envText.match(/VITE_SUPABASE_URL=["']?([^"'\s]+)["']?/);
  const keyMatch = envText.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=["']?([^"'\s]+)["']?/);
  
  if (!urlMatch || !keyMatch) {
    console.error("No se encontraron las credenciales en .env.local");
    process.exit(1);
  }

  const url = urlMatch[1];
  const key = keyMatch[1];
  const supabase = createClient(url, key);

  const { data, error: fetchError } = await supabase
    .from('cat_gerencias')
    .select('*')
    .eq('nombre', 'Contabilidad');

  if (fetchError) {
    console.error("Error al buscar:", fetchError);
    process.exit(1);
  }

  if (data.length === 0) {
    const { error: insertError } = await supabase
      .from('cat_gerencias')
      .insert([{ nombre: 'Contabilidad', abreviatura: 'CNT' }]);
    
    if (insertError) {
      console.error("Error al insertar:", insertError);
      process.exit(1);
    }
    console.log('Contabilidad añadida a cat_gerencias exitosamente.');
  } else {
    console.log('Contabilidad ya existe en cat_gerencias.');
  }
}

run();
