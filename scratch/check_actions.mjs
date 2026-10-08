import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let envUrl = '', envKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(envUrl, envKey);

async function checkActions() {
  const { data: logs } = await supabase.from('requisicion_logs').select('accion');
  const counts = {};
  logs.forEach(l => {
    counts[l.accion] = (counts[l.accion] || 0) + 1;
  });
  console.log('Acciones en requisicion_logs:', counts);
}

checkActions();
