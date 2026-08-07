import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const credentials = [
  { email: 'jcontreras.totalclean@gmail.com', password: '123456' },
  { email: 'cvega.totalclean@gmail.com', password: '123456' },
  { email: 'cvega@totalclean.com', password: '123456' },
  { email: 'karincmm1@gmail.com', password: '123456' },
  { email: 'cvega@totalclean.com', password: 'TotalClean123!' },
  { email: 'jcontreras.totalclean@gmail.com', password: 'TotalClean123!' }
];

async function tryLogins() {
  for (const cred of credentials) {
    console.log(`Trying login for ${cred.email}...`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cred.email,
      password: cred.password
    });

    if (error) {
      console.log(`Failed: ${error.message}`);
    } else {
      console.log(`SUCCESS! Logged in as ${cred.email}`);
      const { data: perfiles, error: pError } = await supabase.from('perfiles').select('nombre, apellido, rol').limit(3);
      if (pError) {
        console.log("Failed to fetch perfiles:", pError.message);
      } else {
        console.log("Fetched some perfiles:", perfiles);
      }
      return;
    }
  }
}
tryLogins();
