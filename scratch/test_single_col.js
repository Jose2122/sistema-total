import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const cleanLine = line.replace(/\r/g, '').trim();
  const match = cleanLine.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkCol(colName) {
  const { data, error } = await supabase
    .from('tickets_directos')
    .select(colName)
    .limit(1);
  if (error) {
    console.log(`❌ Column '${colName}': DOES NOT EXIST (${error.message})`);
    return false;
  } else {
    console.log(`✅ Column '${colName}': EXISTS`);
    return true;
  }
}

async function run() {
  const cols = [
    'usuario_id',
    'gerente_nombre',
    'departamento',
    'fecha_emision',
    'codigo_control',
    'total_usd',
    'items',
    'factura_url',
    'status',
    'solicitud_ref',
    'clasificacion_admin',
    'justificacion',
    'observaciones',
    'centro_costo',
    'con_iva',
    'prioridad',
    'aprobador_id',
    'aprobado_por',
    'fecha_aprobacion',
    'aprobado_gerente_area',
    'n_aprobacion_area',
    'f_aprobacion_area',
    'aprobado_gerente_general',
    'n_aprobacion_general',
    'f_aprobacion_general',
    'motivo_rechazo'
  ];
  
  console.log("Checking all columns of tickets_directos table...");
  for (const c of cols) {
    await checkCol(c);
  }
}

run();
