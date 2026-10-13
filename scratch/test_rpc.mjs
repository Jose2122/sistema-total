import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) env[match[1]] = (match[2]||'').replace(/^['"]|['"]$/g, '').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testRpc() {
  const { data, error } = await supabase.rpc('exec_sql', { query: 'SELECT 1;' });
  console.log('exec_sql:', error ? error.message : 'SUCCESS');
}

testRpc();
