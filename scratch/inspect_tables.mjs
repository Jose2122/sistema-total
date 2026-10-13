import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    val = val.replace(/^['"]|['"]$/g, '').trim();
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const tables = [
    'cuentas_por_pagar',
    'compras_retenciones',
    'facturas',
    'compras',
    'ordenes_compra',
    'historial_pagos_compras',
    'tasas_cambio',
    'configuracion'
  ];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(2);
    if (error) {
      console.log(`${t}: ERROR -> ${error.message} (code: ${error.code})`);
    } else {
      console.log(`${t}: OK -> found ${data.length} records. Sample keys: ${data.length > 0 ? Object.keys(data[0]).join(', ') : 'empty'}`);
    }
  }
}

check();
