import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let envUrl = '', envKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(envUrl, envKey);

async function inspectSchema() {
  const tables = [
    { name: 'tickets_directos', cols: 'id, created_at, fecha_emision, departamento, centro_costo, total_usd, total_ves, estado, solicitante, beneficiario' },
    { name: 'ordenes_compra', cols: 'id, numero_odc, created_at, fecha_emision, proveedor_nombre, total_moneda_origen, moneda, estado, tipo_pago, requisicion_codigo, centro_costo, departamento' },
    { name: 'solicitudes_fondos', cols: 'id, codigo_control, created_at, fecha_operativa, responsable_nombre, estado, total_usd, total_ves, departamento' },
    { name: 'partidas_fondos', cols: 'id, solicitud_id, created_at, n_renglon, concepto, monto_usd, monto_ves, status' },
    { name: 'requisicion_logs', cols: 'id, requisicion_id, accion, comentario, fecha, usuario_nombre, created_at' }
  ];

  for (const t of tables) {
    const { data, error } = await supabase.from(t.name).select(t.cols).limit(2);
    if (error) {
      console.log(`ERROR on '${t.name}':`, error.message, error.code);
      const { data: rawData, error: rawError } = await supabase.from(t.name).select('*').limit(1);
      if (rawError) console.log(`  -> Even select(*) failed:`, rawError.message);
      else console.log(`  -> Real columns in '${t.name}':`, Object.keys(rawData[0] || {}));
    } else {
      console.log(`✓ '${t.name}' query SUCCESS! Sample:`, data[0] || 'EMPTY');
    }
  }
}

inspectSchema();
