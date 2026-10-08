import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let envUrl = '', envKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(envUrl, envKey);

async function checkDateRanges() {
  const { data: logs } = await supabase.from('requisicion_logs').select('fecha').order('fecha', { ascending: true });
  console.log('Total logs:', logs.length);
  if (logs.length > 0) {
    console.log('Earliest log date:', logs[0].fecha);
    console.log('Latest log date:', logs[logs.length - 1].fecha);
  }

  const { data: reqs } = await supabase.from('requisiciones').select('created_at, fecha_emision').order('created_at', { ascending: true });
  console.log('Total reqs:', reqs.length);
  if (reqs.length > 0) {
    console.log('Earliest req created_at:', reqs[0].created_at);
    console.log('Latest req created_at:', reqs[reqs.length - 1].created_at);
  }
}

checkDateRanges();
