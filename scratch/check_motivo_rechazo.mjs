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

async function testColumn() {
  const { error } = await supabase
    .from('tickets_directos')
    .select('motivo_rechazo')
    .limit(1);

  if (error && error.message.includes('does not exist')) {
    console.log("❌ Column 'motivo_rechazo' DOES NOT EXIST");
  } else if (error) {
    console.log(`❓ Column 'motivo_rechazo' error: ${error.message}`);
  } else {
    console.log("✅ Column 'motivo_rechazo' EXISTS");
  }
}

testColumn();
