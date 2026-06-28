import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

let envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  envPath = path.resolve('.env.local');
}
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

async function run() {
  const cols = ['finalizado', 'finalizada', 'completado', 'completada', 'cerrado', 'cerrada', 'estado_solicitud', 'bloqueado', 'estado'];
  console.log("Checking columns in solicitudes_fondos...");
  for (const col of cols) {
    const { error } = await supabase.from('solicitudes_fondos').select(col).limit(1);
    if (error) {
      console.log(`  Column "${col}": ERROR -> ${error.message}`);
    } else {
      console.log(`  Column "${col}": EXISTS`);
    }
  }
}
run();
