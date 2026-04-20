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

  const { data, error } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public');
  if (error) {
    console.error("Error al listar tablas:", error);
  } else {
    console.log("Tablas encontradas:", data.map(t => t.table_name));
  }
}

run();
