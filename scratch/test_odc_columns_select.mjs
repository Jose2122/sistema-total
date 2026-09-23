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

const testList = [
  'id', 'numero_odc', 'requisicion_id', 'proveedor_id', 'proveedor_nombre', 'proveedor_rif',
  'proveedor_contacto', 'proveedor_ciudad', 'proveedor_direccion', 'cotizacion_ref',
  'fecha_cotizacion', 'fecha_despacho', 'fecha_emision', 'tipo_pago', 'dias_credito',
  'fecha_vencimiento_credito', 'fecha_vencimiento_pago', 'moneda', 'tasa_bcv',
  'despachar_a_direccion', 'destino_despacho', 'terminos_condiciones', 'subtotal',
  'iva_porcentaje', 'porcentaje_iva', 'iva_monto', 'total', 'total_general',
  'estatus_pago', 'estatus_recepcion', 'carlos_firma_digital_activa', 'carlos_firma_fecha',
  'comprador_nombre', 'gerente_compras_nombre', 'observaciones', 'banco', 'banco_destino',
  'cuenta_bancaria', 'datos_pago', 'datos_bancarios', 'detalles_pago', 'forma_pago'
];

async function run() {
  const validCols = [];
  const invalidCols = [];

  for (const col of testList) {
    const { error } = await supabase.from('ordenes_compra').select(col).limit(1);
    if (error && error.message.includes('Could not find')) {
      invalidCols.push(col);
    } else {
      validCols.push(col);
    }
  }

  console.log('Valid ODC columns:', validCols);
  console.log('Invalid ODC columns:', invalidCols);
}

run();
