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
  const sf_cols = ['id', 'codigo_control', 'fecha_operativa', 'sede', 'gerencia_nombre', 'responsable_nombre', 'total_bs', 'total_usd', 'created_at', 'estado', 'status', 'semana'];
  console.log("Checking columns in solicitudes_fondos...");
  for (const col of sf_cols) {
    const { error } = await supabase.from('solicitudes_fondos').select(col).limit(1);
    if (error) {
      console.log(`  Column "${col}": ERROR -> ${error.message}`);
    } else {
      console.log(`  Column "${col}": EXISTS`);
    }
  }

  const pf_cols = ['id', 'solicitud_id', 'n_renglon', 'centro_costo', 'clasificacion', 'categoria', 'cantidad', 'unidad', 'descripcion', 'beneficiario', 'pu_bs', 'pu_usd', 'pago_realizado', 'emisor_nombre', 'requisicion_id', 'ticket_id', 'codigo_ticket', 'status', 'motivo_anulacion', 'justificacion_anulacion', 'anulado_usuario', 'anulado_por'];
  console.log("\nChecking columns in partidas_fondos...");
  for (const col of pf_cols) {
    const { error } = await supabase.from('partidas_fondos').select(col).limit(1);
    if (error) {
      console.log(`  Column "${col}": ERROR -> ${error.message}`);
    } else {
      console.log(`  Column "${col}": EXISTS`);
    }
  }
}
run();
