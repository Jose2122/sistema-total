import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
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

async function testColumns() {
  const columns = [
    'aprobado_gerente_proyecto',
    'aprobado_gerente_area',
    'aprobado_gerente_general',
    'f_aprobacion_proyecto',
    'f_aprobacion_area',
    'f_aprobacion_general',
    'n_aprobacion_proyecto',
    'n_aprobacion_area',
    'n_aprobacion_general',
    'aprobado_por_nombre',
    'fecha_aprobacion',
    'aprobador_id',
    'pagado_por_nombre',
    'fecha_pago'
  ];

  console.log('Testing column existence in tickets_directos...');
  for (const col of columns) {
    const { error } = await supabase
      .from('tickets_directos')
      .select(col)
      .limit(1);
    
    if (error && error.message.includes('does not exist')) {
      console.log(`❌ Column '${col}' DOES NOT EXIST`);
    } else if (error) {
      console.log(`❓ Column '${col}' returned error: ${error.message} (${error.code})`);
    } else {
      console.log(`✅ Column '${col}' EXISTS`);
    }
  }
}

testColumns();
