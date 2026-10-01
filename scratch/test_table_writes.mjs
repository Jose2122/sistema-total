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

async function testWriteOnTables() {
  // Test writing on proveedores
  const { data: pD, error: pE } = await supabase.from('proveedores').insert([{ razon_social: 'TEST' }]).select();
  console.log("Write on proveedores:", pE ? pE.message : "SUCCESS!");

  // Test writing on logs_actividad
  const { data: lD, error: lE } = await supabase.from('logs_actividad').insert([{ accion: 'TEST_PROV', modulo: 'PROVEEDORES' }]).select();
  console.log("Write on logs_actividad:", lE ? lE.message : "SUCCESS!");

  // Test writing on notificaciones
  const { data: nD, error: nE } = await supabase.from('notificaciones').insert([{ mensaje: 'TEST', leido: false }]).select();
  console.log("Write on notificaciones:", nE ? nE.message : "SUCCESS!");

  // Test writing on bancos
  const { data: bD, error: bE } = await supabase.from('bancos').insert([{ nombre: 'TEST_BANCO_TMP' }]).select();
  console.log("Write on bancos:", bE ? bE.message : "SUCCESS!");
  if (!bE && bD && bD[0]) {
    await supabase.from('bancos').delete().eq('id', bD[0].id);
  }

  // Test writing on requisiciones
  // We don't want to pollute requisiciones, let's test if we can update or read a system requisition
}

testWriteOnTables();
