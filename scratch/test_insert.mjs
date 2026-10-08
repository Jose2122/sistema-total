import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
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

async function testInsert() {
  const dbPayload = {
    rif: 'J-40282085-2',
    razon_social: 'TECHNOLOGY AND SERVICE',
    persona_contacto: 'TECHNOLOGY AND SERVICE',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    correo: 'TECHNOLOGYANDSERVICE@GMAIL.COM',
    telefono: '0424-654-5244',
    direccion: 'AV . 3H ENTRE CALLE 78 Y79 EDIF GINEBRA LOCAL 4',
    categoria: 'TECNOLOGÍA',
    dias_credito_habituales: 0,
    condicion_pago_defecto: 'CONTADO',
    status: true,
    cuentas_bancarias: []
  };

  const { data, error } = await supabase.from('proveedores').insert([dbPayload]).select();
  console.log('Insert result data:', data, 'error:', error);
}
testInsert();
