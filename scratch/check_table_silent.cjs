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

  try {
    const { data, error } = await supabase.from('cat_cargos').select('*').limit(1);
    if (error) {
      console.log('MISSING');
    } else {
      console.log('EXISTS');
    }
  } catch (e) {
    console.log('MISSING');
  }
}

run();
