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

const candidates = [
  'almacen',
  'almacen_recibido',
  'almacen_destino',
  'ubicacion',
  'destino',
  'almacen_nombre',
  'bodega',
  'tipo_almacen'
];

async function run() {
  for (const col of candidates) {
    const testData = {
      requisicion_id: '00000000-0000-0000-0000-000000000000', // dummy uuid
      item_index: 0,
      cantidad_recibida: 0,
      recibido_por: 'Test',
      [col]: 'Test Val'
    };
    const { error } = await supabase.from('almacen_recepcion').insert([testData]);
    if (error) {
      if (error.message.includes('Could not find the')) {
        console.log(`Column '${col}' does NOT exist.`);
      } else {
        console.log(`Column '${col}' EXISTS (returned error: ${error.message}).`);
      }
    } else {
      console.log(`Column '${col}' EXISTS (insertion succeeded).`);
    }
  }
}
run();
