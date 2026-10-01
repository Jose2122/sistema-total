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

async function testInsert() {
  const testPayload = {
    rif: 'J-12345678-0',
    razon_social: 'TEST PROVEEDOR AUTO INSERT',
    persona_contacto: 'Juan Perez',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    correo: 'test@proveedor.com',
    telefono: '0414-1234567',
    direccion: 'Zona Industrial Maracaibo',
    categoria: 'REPUESTO',
    dias_credito_habituales: 15,
    condicion_pago_defecto: 'CREDITO',
    status: true,
    cuentas_bancarias: [{ banco: 'Banesco', moneda: 'USD', nro_cuenta: '0134000000000', titular: 'Test' }]
  };

  const { data, error } = await supabase.from('proveedores').insert([testPayload]).select();
  console.log("Insert result:", { data, error });

  if (data && data[0]) {
    const testId = data[0].id;
    console.log("Inserted ID:", testId);

    // Now test update
    const { data: upData, error: upErr } = await supabase.from('proveedores')
      .update({ persona_contacto: 'Juan Perez Modificado' })
      .eq('id', testId)
      .select();
    console.log("Update result:", { upData, upErr });

    // Cleanup
    const { error: delErr } = await supabase.from('proveedores').delete().eq('id', testId);
    console.log("Delete cleanup:", { delErr });
  }
}

testInsert();
