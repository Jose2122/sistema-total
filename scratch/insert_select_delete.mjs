import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Signing in...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'jcontreras.totalclean@gmail.com',
    password: '123456'
  });

  if (authError) {
    console.error("Sign in error:", authError.message);
    return;
  }
  console.log("Signed in successfully as:", authData.user.email);

  const dummyCode = 'DUMMY_TEST_' + Date.now();
  try {
    console.log("Inserting dummy ticket...");
    const { data: inserted, error: insertError } = await supabase
      .from('tickets_directos')
      .insert([{
        codigo_control: dummyCode,
        gerente_nombre: 'Test System',
        departamento: 'Operaciones',
        fecha_emision: new Date().toISOString().split('T')[0],
        total_usd: 0,
        items: []
      }])
      .select();

    if (insertError) {
      console.error("Insert error:", insertError.message);
      return;
    }

    if (inserted && inserted.length > 0) {
      console.log("SUCCESS! Columns found in tickets_directos:");
      console.log(Object.keys(inserted[0]));
      console.log("Sample record:", inserted[0]);
    } else {
      console.log("Insert succeeded but select returned no data.");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    console.log("Cleaning up dummy ticket...");
    const { error: deleteError } = await supabase
      .from('tickets_directos')
      .delete()
      .eq('codigo_control', dummyCode);
    if (deleteError) {
      console.error("Cleanup error:", deleteError.message);
    } else {
      console.log("Cleanup finished.");
    }
  }
}
run();
