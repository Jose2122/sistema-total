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

const key = env.VITE_SUPABASE_ANON_KEY;
console.log("Using URL:", env.VITE_SUPABASE_URL);
const supabase = createClient(env.VITE_SUPABASE_URL, key);

async function run() {
  console.log("Logging in as admin to get bypass...");
  // Let's list the profiles to find a valid user or just query directly if RLS is bypassable with an admin account or if we can use service role key
  // Wait, does .env or .env.local have SUPABASE_SERVICE_ROLE_KEY or can we find it?
  // Let's read the .env file to see what keys are there.
  const envMainContent = fs.readFileSync(path.resolve('.env'), 'utf-8');
  console.log("Main .env keys present:", envMainContent.split('\n').map(l => l.split('=')[0]).join(', '));
}
run();
