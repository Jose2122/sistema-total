import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '').replace('\r', '');
    env[k] = v;
  }
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const candidateCols = [
  'id', 'rif', 'razon_social', 'persona_contacto', 'contacto_nombre', 
  'contacto_administrativo', 'ciudad', 'localizacion', 'correo', 'telefono', 
  'direccion', 'categoria', 'monto_limite_credito', 'limite_credito', 
  'dias_credito', 'dias_credito_habituales', 'condicion_pago_defecto', 
  'calificacion_precio', 'calificacion_cumplimiento', 'observaciones_negociacion', 
  'es_preferencial', 'proveedor_preferencial', 'nivel_preferencial', 
  'descuento_pactado_porcentaje', 'dias_credito_pactados', 'tiempo_entrega_acordado_dias', 
  'vigencia_acuerdo_desde', 'vigencia_acuerdo_hasta', 'condiciones_acuerdo_nota', 
  'status', 'cuentas_bancarias', 'creado_por', 'creado_por_nombre', 
  'actualizado_por', 'actualizado_por_nombre', 'created_at', 'updated_at'
];

async function checkCols() {
  const existing = [];
  const missing = [];
  for (const c of candidateCols) {
    const { error } = await supabase.from('proveedores').select(c).limit(1);
    if (!error) existing.push(c);
    else missing.push(c);
  }
  console.log('Existing columns in proveedores:', existing);
  console.log('Missing columns in proveedores:', missing);
}
checkCols();
