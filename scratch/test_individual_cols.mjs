import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const candidates = [
  'proveedor_cuenta_banco',
  'proveedor_cuenta_numero',
  'proveedor_cuenta_detalles',
  'datos_bancarios_proveedor',
  'datos_bancarios',
  'banco_pago',
  'banco_pago_id',
  'cuenta_banco',
  'cuenta_proveedor',
  'observaciones'
];

async function run() {
  for (const col of candidates) {
    const { error } = await supabase.from('ordenes_compra').insert([{ [col]: 'test' }]);
    if (error && error.message.includes('Could not find')) {
      console.log(`Column ${col}: NO`);
    } else {
      console.log(`Column ${col}: YES or constraint error -> ${error?.message}`);
    }
  }
}

run();
