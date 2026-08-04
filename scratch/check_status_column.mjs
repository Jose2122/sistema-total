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

async function checkColumns() {
  const resStatus = await supabase.from('tickets_directos').select('status').limit(1);
  const resEstatus = await supabase.from('tickets_directos').select('estatus').limit(1);

  if (resStatus.error && resStatus.error.message.includes('does not exist')) {
    console.log("❌ Column 'status' DOES NOT EXIST");
  } else if (resStatus.error) {
    console.log(`❓ Column 'status' returned error: ${resStatus.error.message}`);
  } else {
    console.log("✅ Column 'status' EXISTS");
  }

  if (resEstatus.error && resEstatus.error.message.includes('does not exist')) {
    console.log("❌ Column 'estatus' DOES NOT EXIST");
  } else if (resEstatus.error) {
    console.log(`❓ Column 'estatus' returned error: ${resEstatus.error.message}`);
  } else {
    console.log("✅ Column 'estatus' EXISTS");
  }
}

checkColumns();
