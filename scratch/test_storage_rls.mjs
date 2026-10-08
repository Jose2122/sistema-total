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

async function testAll() {
  console.log("1. Probando bucket facturas...");
  const dummyBuffer = Buffer.from("test content");
  const testFileName = `test_upload_${Date.now()}.txt`;
  const { data: upData, error: upError } = await supabase.storage
    .from('facturas')
    .upload(testFileName, dummyBuffer, { contentType: 'text/plain', upsert: true });
  console.log("Resultado upload facturas:", upData, "Error:", upError);

  if (!upError) {
    await supabase.storage.from('facturas').remove([testFileName]);
  }

  console.log("2. Probando buckets existentes...");
  const { data: buckets, error: bError } = await supabase.storage.listBuckets();
  console.log("Buckets:", buckets, "Error:", bError);

  console.log("3. Probando insert proveedores...");
  const { data: pData, error: pError } = await supabase.from('proveedores').insert([{
    rif: 'J-40282085-2',
    razon_social: 'TECHNOLOGY AND SERVICE',
    persona_contacto: 'TECHNOLOGY AND SERVICE',
    ciudad: 'Maracaibo',
    telefono: '0424-654-5244',
    direccion: 'AV . 3H ENTRE CALLE 78 Y79 EDIF GINEBRA LOCAL 4',
    categoria: 'TECNOLOGÍA'
  }]).select();
  console.log("Resultado insert proveedores:", pData, "Error:", pError);
}
testAll();
