import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const candidates = [
  'id', 'numero_odc', 'requisicion_id', 'proveedor_id', 'proveedor_nombre', 'proveedor_rif',
  'cotizacion_ref', 'fecha_cotizacion', 'tipo_pago', 'dias_credito', 'fecha_emision',
  'fecha_vencimiento_pago', 'moneda', 'destino_despacho', 'terminos_condiciones',
  'subtotal', 'porcentaje_iva', 'total_general', 'elaborado_por_id', 'elaborado_por_nombre',
  'revisado_por_nombre', 'aprobado_por_nombre', 'comprador_gestor_id', 'comprador_nombre',
  'gerente_compras_id', 'gerente_compras_nombre', 'fecha_aval_compras', 'despachar_a_id',
  'despachar_a_direccion', 'fecha_vencimiento_credito', 'iva_porcentaje', 'iva_monto',
  'total', 'tasa_bcv', 'status_pago', 'estatus_pago', 'estatus_orden', 'carlos_firma_digital_activa',
  'carlos_firma_fecha', 'carlos_comentario_aprobacion', 'observaciones', 'created_at',
  'condicion_pago', 'estado_aprobacion_precio', 'prioridad_pago', 'aprobado_compras_por',
  'fecha_aprobacion_compras', 'motivo_rechazo_compras', 'estatus_recepcion', 'fecha_recepcion',
  'recibido_por', 'usuario_id'
];

async function run() {
  const existing = [];
  const missing = [];
  for (const col of candidates) {
    const { error } = await supabase.from('ordenes_compra').select(col).limit(1);
    if (error && (error.message.includes('Could not find') || error.message.includes('does not exist'))) {
      missing.push(col);
    } else if (error) {
      console.log(`Column ${col}: ERROR ${error.message}`);
    } else {
      existing.push(col);
    }
  }
  console.log('--- EXISTING COLUMNS (', existing.length, ') ---');
  console.log(existing.join(', '));
  console.log('\n--- MISSING COLUMNS (', missing.length, ') ---');
  console.log(missing.join(', '));
}

run();
