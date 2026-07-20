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
    const codigos = ['EST-SEM 28-26', 'EST-SEM 27-26'];
    
    // 1. Fetch the solicitudes
    const { data: sols, error: errSols } = await supabase
      .from('solicitudes_fondos')
      .select('*')
      .in('codigo_control', codigos);
      
    if (errSols) throw errSols;
    
    console.log('=== SOLICITUDES ===');
    console.dir(sols, { depth: null });
    
    if (sols && sols.length > 0) {
      const solIds = sols.map(s => s.id);
      
      // 2. Fetch the partidas_fondos for these solicitudes
      const { data: partidas, error: errPartidas } = await supabase
        .from('partidas_fondos')
        .select('*')
        .in('solicitud_id', solIds);
        
      if (errPartidas) throw errPartidas;
      
      console.log('\n=== PARTIDAS FONDOS ===');
      console.dir(partidas, { depth: null });
      
      // 3. For any tickets linked, fetch their details
      const ticketIds = partidas.map(p => p.ticket_id).filter(Boolean);
      const ticketCodes = partidas.map(p => p.codigo_ticket).filter(Boolean);
      
      if (ticketIds.length > 0 || ticketCodes.length > 0) {
        let q = supabase.from('tickets_directos').select('*');
        if (ticketIds.length > 0 && ticketCodes.length > 0) {
          q = q.or(`id.in.(${ticketIds.join(',')}),codigo_control.in.(${ticketCodes.map(c => `"${c}"`).join(',')})`);
        } else if (ticketIds.length > 0) {
          q = q.in('id', ticketIds);
        } else {
          q = q.in('codigo_control', ticketCodes);
        }
        
        const { data: tickets, error: errTickets } = await q;
        if (errTickets) throw errTickets;
        
        console.log('\n=== INVOLVED TICKETS ===');
        console.dir(tickets, { depth: null });
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
