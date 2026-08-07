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

async function check() {
  console.log("Signing in as tostitomas@gmail.com...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'tostitomas@gmail.com',
    password: '123456'
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }

  console.log("Login Success! User ID:", authData.user.id);
  const { data: profile, error: pError } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (pError) {
    console.error("Profile fetch failed:", pError.message);
  } else {
    console.log("Profile Data:", JSON.stringify(profile, null, 2));
  }
}
check();
