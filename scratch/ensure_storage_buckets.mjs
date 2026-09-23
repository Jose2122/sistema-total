import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkBuckets() {
  const bucketsToEnsure = ['facturas', 'tickets-evidencia', 'comprobantes'];
  for (const b of bucketsToEnsure) {
    const { data, error } = await supabase.storage.getBucket(b);
    if (error && error.message.includes('not found')) {
      console.log(`Bucket ${b} not found, attempting to create...`);
      const { data: createData, error: createError } = await supabase.storage.createBucket(b, {
        public: true
      });
      if (createError) {
        console.error(`Error creating bucket ${b}:`, createError.message);
      } else {
        console.log(`Successfully created bucket ${b}!`);
      }
    } else if (error) {
      console.log(`Bucket check for ${b}:`, error.message);
    } else {
      console.log(`Bucket ${b} exists and is active!`);
    }
  }
}

checkBuckets();
