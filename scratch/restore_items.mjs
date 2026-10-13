import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '').replace('\r', '');
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const itemsParaRestaurar = [
  {
    id: 1,
    item_numero: 1,
    codigo: 'R01-074',
    descripcion: 'TOR HEX G2 NC 3/8-16X1-1/2',
    cant: 160,
    cantidad: 160,
    cantidad_pedida: 160,
    cant_aprobada: 160,
    cantidad_comprada: 0,
    cantidad_pendiente: 160,
    uni: 'UND',
    unidad: 'UND',
    categoria: 'MATERIALES',
    clasificacion: 'Operativo',
    pu: 2.20,
    total: 352.00,
    status: 'En Espera',
    estado_item: 'pendiente',
    historial_compras: []
  },
  {
    id: 2,
    item_numero: 2,
    codigo: '147-004',
    descripcion: 'TCA SEGURIDAD NC 3/8-16',
    cant: 160,
    cantidad: 160,
    cantidad_pedida: 160,
    cant_aprobada: 160,
    cantidad_comprada: 0,
    cantidad_pendiente: 160,
    uni: 'UND',
    unidad: 'UND',
    categoria: 'MATERIALES',
    clasificacion: 'Operativo',
    pu: 0.8075,
    total: 129.20,
    status: 'En Espera',
    estado_item: 'pendiente',
    historial_compras: []
  },
  {
    id: 3,
    item_numero: 3,
    codigo: 'D01-052',
    descripcion: 'ARANDELA PLANA NAT 3/8',
    cant: 160,
    cantidad: 160,
    cantidad_pedida: 160,
    cant_aprobada: 160,
    cantidad_comprada: 0,
    cantidad_pendiente: 160,
    uni: 'UND',
    unidad: 'UND',
    categoria: 'MATERIALES',
    clasificacion: 'Operativo',
    pu: 0.55,
    total: 88.00,
    status: 'En Espera',
    estado_item: 'pendiente',
    historial_compras: []
  },
  {
    id: 4,
    item_numero: 4,
    codigo: 'D06-006',
    descripcion: 'ARANDELA PRESION 3/8',
    cant: 160,
    cantidad: 160,
    cantidad_pedida: 160,
    cant_aprobada: 160,
    cantidad_comprada: 0,
    cantidad_pendiente: 160,
    uni: 'UND',
    unidad: 'UND',
    categoria: 'MATERIALES',
    clasificacion: 'Operativo',
    pu: 0.4425,
    total: 70.80,
    status: 'En Espera',
    estado_item: 'pendiente',
    historial_compras: []
  }
];

async function restaurar() {
  console.log('Restaurando items para requisición 2119 (RR-OPE-26-0274)...');
  const { data: d2119, error: e2119 } = await supabase
    .from('requisiciones')
    .update({
      items: itemsParaRestaurar,
      total_bs: 742.4
    })
    .eq('id', 2119)
    .select('id, correlativo_req, items, status_compra');
  console.log('Resultado 2119:', d2119, e2119);

  console.log('Restaurando items para requisición 2115 (RR-OPE-26-0273)...');
  const { data: d2115, error: e2115 } = await supabase
    .from('requisiciones')
    .update({
      items: itemsParaRestaurar,
      total_bs: 742.4
    })
    .eq('id', 2115)
    .select('id, correlativo_req, items, status_compra');
  console.log('Resultado 2115:', d2115, e2115);
}

restaurar();
