const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  try {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre, apellido, rol, departamento, activo')
      .or('nombre.ilike.%Ricardo%,apellido.ilike.%Herrera%,apellido.ilike.%Enrique%');
    if (error) throw error;
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e.message);
  }
}
check();
