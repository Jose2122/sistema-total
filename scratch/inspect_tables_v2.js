import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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

async function run() {
  try {
    const { data: reqs, error: err1 } = await supabase.from('requisiciones').select('*').limit(1);
    if (err1) throw err1;
    if (reqs && reqs.length > 0) {
      console.log('Columns of requisiciones:', Object.keys(reqs[0]));
    } else {
      console.log('No rows in requisiciones.');
    }

    const { data: tickets, error: err2 } = await supabase.from('tickets_directos').select('*').limit(1);
    if (err2) throw err2;
    if (tickets && tickets.length > 0) {
      console.log('Columns of tickets_directos:', Object.keys(tickets[0]));
    } else {
      console.log('No rows in tickets_directos.');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
