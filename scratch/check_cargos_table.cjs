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

  const tablesToCheck = ['cat_cargos', 'maestros_cargos', 'cat_roles', 'maestros_roles'];
  for (const table of tablesToCheck) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      console.log(`Tabla encontrada: ${table}`);
      return;
    } else if (error.code !== '42P01') { // 42P01 is undefined_table
      console.log(`Tabla ${table} dio error: ${error.code} - ${error.message}`);
    }
  }
  console.log("No se encontró ninguna tabla de cargos.");
}

run();
