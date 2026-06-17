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

async function run() {
  try {
    const { data, error } = await supabase.rpc('execute_sql_query', {
      sql_query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tickets_directos'"
    });
    if (error) {
      // If RPC execute_sql_query doesn't exist, try querying directly or checking another table
      console.log('RPC execution error:', error);
      // Fallback: let's query any row from tickets_directos or just print error
      const { data: cols, error: err2 } = await supabase.from('tickets_directos').select('*').limit(1);
      if (err2) throw err2;
      if (cols && cols.length > 0) {
        console.log('Columns from sample row:', Object.keys(cols[0]));
      } else {
        console.log('No rows returned, columns check fallback failed');
      }
    } else {
      console.log('Columns of tickets_directos:', data);
    }
  } catch (err) {
    console.error('Error running inspect script:', err);
  }
}
run();
