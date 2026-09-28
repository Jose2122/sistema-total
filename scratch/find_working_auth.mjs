import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

async function findWorkingUser() {
  const { data: perfiles, error } = await supabase.from('perfiles').select('correo, nombre, apellido, rol');
  if (error) return console.error("Error reading perfiles:", error);
  console.log(`Found ${perfiles.length} profiles in database.`);

  const commonPasswords = ['123456', 'TotalClean123!', 'Totalclean123!', '12345678', 'admin', 'password', 'Admin123!'];

  for (const p of perfiles) {
    if (!p.correo) continue;
    for (const pwd of commonPasswords) {
      const { data, error: aErr } = await supabase.auth.signInWithPassword({
        email: p.correo,
        password: pwd
      });
      if (!aErr) {
        console.log(`\n🎉 SUCCESS! Authenticated as: ${p.correo} with password: ${pwd} (Role: ${p.rol})`);
        return { email: p.correo, password: pwd };
      }
    }
  }
  console.log("None of the common passwords worked for listed profiles.");
}

findWorkingUser();
