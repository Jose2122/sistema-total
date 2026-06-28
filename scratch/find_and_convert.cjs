const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) { process.env[k] = envConfig[k]; }
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const targets = ['Administración', 'Administracion'];
  
  // 1. Check perfiles
  console.log("Checking perfiles...");
  for (const t of targets) {
    const { data, error } = await supabase.from('perfiles').select('id, nombre, apellido, departamento').eq('departamento', t);
    if (error) console.error("perfiles check error:", error);
    else if (data && data.length > 0) {
      console.log(`Found ${data.length} profiles with department '${t}':`, data);
      const { error: uError } = await supabase.from('perfiles').update({ departamento: 'Administración Maracaibo' }).eq('departamento', t);
      if (uError) console.error("perfiles update error:", uError);
      else console.log(`Successfully updated perfiles from '${t}' to 'Administración Maracaibo'`);
    }
  }

  // 2. Check tickets_directos
  console.log("Checking tickets_directos...");
  for (const t of targets) {
    const { data, error } = await supabase.from('tickets_directos').select('id, codigo_control, departamento').eq('departamento', t);
    if (error) console.error("tickets_directos check error:", error);
    else if (data && data.length > 0) {
      console.log(`Found ${data.length} tickets with department '${t}':`, data);
      const { error: uError } = await supabase.from('tickets_directos').update({ departamento: 'Administración Maracaibo' }).eq('departamento', t);
      if (uError) console.error("tickets_directos update error:", uError);
      else console.log(`Successfully updated tickets_directos from '${t}' to 'Administración Maracaibo'`);
    }
  }

  // 3. Check requisiciones
  console.log("Checking requisiciones...");
  for (const t of targets) {
    const { data, error } = await supabase.from('requisiciones').select('id, codigo_control, gerencia').eq('gerencia', t);
    if (error) console.error("requisiciones check error:", error);
    else if (data && data.length > 0) {
      console.log(`Found ${data.length} requisiciones with gerencia '${t}'`);
      const { error: uError } = await supabase.from('requisiciones').update({ gerencia: 'Administración Maracaibo' }).eq('gerencia', t);
      if (uError) console.error("requisiciones update error:", uError);
      else console.log(`Successfully updated requisiciones from '${t}' to 'Administración Maracaibo'`);
    }
  }

  // 4. Check solicitudes_fondos
  console.log("Checking solicitudes_fondos...");
  for (const t of targets) {
    const { data, error } = await supabase.from('solicitudes_fondos').select('id, codigo_control, gerencia').eq('gerencia', t);
    if (error) console.error("solicitudes_fondos check error:", error);
    else if (data && data.length > 0) {
      console.log(`Found ${data.length} solicitudes_fondos with gerencia '${t}'`);
      const { error: uError } = await supabase.from('solicitudes_fondos').update({ gerencia: 'Administración Maracaibo' }).eq('gerencia', t);
      if (uError) console.error("solicitudes_fondos update error:", uError);
      else console.log(`Successfully updated solicitudes_fondos from '${t}' to 'Administración Maracaibo'`);
    }
  }

  console.log("Unification run completed.");
}

run();
