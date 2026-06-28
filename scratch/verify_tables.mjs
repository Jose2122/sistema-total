import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTables() {
  const { data: tables, error } = await supabase.rpc('get_tables'); // O un query simple
  
  // Alternativa: intentar leer de 'compras'
  const { error: errorCompras } = await supabase.from('compras').select('count').limit(1);
  const { error: errorReq } = await supabase.from('requisiciones').select('count').limit(1);
  
  console.log("¿Existe tabla 'compras'?", errorCompras ? "NO (o error)" : "SÍ");
  console.log("¿Existe tabla 'requisiciones'?", errorReq ? "NO (o error)" : "SÍ");
  
  if (!errorReq) {
     const { data } = await supabase.from('requisiciones').select('*').limit(1);
     console.log("Columnas en requisiciones:", Object.keys(data[0] || {}));
  }
}

checkTables();
