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

async function tryLogin() {
  console.log("Logging in as tostitomas@gmail.com...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'tostitomas@gmail.com',
    password: '123456'
  });

  if (error) {
    console.log("Failed login:", error.message);
  } else {
    console.log("Logged in successfully!");
    
    // Fetch solicitudes
    const { data: sols, error: solError } = await supabase.from('solicitudes_fondos').select('id, codigo_control').limit(10);
    if (solError) {
      console.error("Sol error:", solError);
    } else {
      console.log("Solicitudes loaded:", sols);
      const ids = sols.map(s => s.id);
      
      // Try the exact query that fails with 400
      const { data: partidas, error: pError } = await supabase
        .from('partidas_fondos')
        .select('solicitud_id, pu_bs, pu_usd, cantidad, pago_realizado, status, requisicion_id, ticket_id, codigo_ticket, descripcion, requisiciones(id, items, status_compra, estado_aprobacion)')
        .in('solicitud_id', ids)
        .limit(5000);
        
      if (pError) {
        console.error("Partidas query failed:", pError);
      } else {
        console.log("Partidas loaded successfully! Count:", partidas.length);
      }
    }
  }
}
tryLogin();
