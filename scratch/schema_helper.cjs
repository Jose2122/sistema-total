const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) { process.env[k] = envConfig[k]; }
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function scan() {
  const tables = ['perfiles', 'requisiciones', 'solicitudes_fondos', 'tickets_directos', 'partidas_fondos'];

  for (const table of tables) {
    console.log(`--- SCANNING TABLE: ${table} ---`);
    // Fetch a single record to get column keys
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Error fetching columns for table ${table}:`, error.message);
      continue;
    }
    if (!data || data.length === 0) {
      console.log(`Table ${table} is empty`);
      continue;
    }
    const cols = Object.keys(data[0]);
    console.log(`Columns for ${table}:`, cols);

    // Look for string columns that contain 'Administración' or 'Administracion'
    for (const col of cols) {
      try {
        const { data: matches, error: mError } = await supabase
          .from(table)
          .select(`id, ${col}`)
          .or(`${col}.eq.Administración,${col}.eq.Administracion`);
        if (!mError && matches && matches.length > 0) {
          console.log(`  [MATCH] Column '${col}' has ${matches.length} matching rows:`);
          console.log(matches);
        }
      } catch (err) {
        // Column might not be queryable (e.g. json or binary)
      }
    }
  }
}

scan();
