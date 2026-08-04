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

async function testColumns() {
  const columns = ['titulo', 'title', 'ticket_id'];
  for (const col of columns) {
    const { error } = await supabase.from('notificaciones').select(col).limit(1);
    if (error && error.message.includes('does not exist')) {
      console.log(`❌ Column '${col}' DOES NOT EXIST`);
    } else if (error) {
      console.log(`❓ Column '${col}' error: ${error.message}`);
    } else {
      console.log(`✅ Column '${col}' EXISTS`);
    }
  }
}

testColumns();
