import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually
const envPath = path.resolve('.env');
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
    // 1. Fetch some tickets
    const { data: tickets, error: errT } = await supabase
      .from('tickets_directos')
      .select('id, codigo_control, status')
      .limit(5);

    if (errT) throw errT;
    console.log("Fetched tickets:", tickets);

    if (tickets.length === 0) {
      console.log("No tickets found to test.");
      return;
    }

    const testTicket = tickets[0];
    console.log(`Testing cancellation of ticket ${testTicket.codigo_control || testTicket.id}...`);

    // Let's check how many partidas_fondos have this ticket_id
    const { data: fundsBefore, error: errF1 } = await supabase
      .from('partidas_fondos')
      .select('id, status, ticket_id, codigo_ticket')
      .eq('ticket_id', testTicket.id);

    if (errF1) throw errF1;
    console.log(`Found ${fundsBefore.length} partidas_fondos before cancellation:`, fundsBefore);

    // Let's attempt the update just like ModuloTicketsPago does
    const { data: updateRes, error: updateErr, count } = await supabase
      .from('partidas_fondos')
      .update({ 
        status: 'Disponible', 
        ticket_id: null, 
        codigo_ticket: null, 
        codigo_ref: null 
      })
      .eq('ticket_id', testTicket.id)
      .select();

    if (updateErr) {
      console.log("Update failed with error:", updateErr.message);
    } else {
      console.log("Update succeeded! Modified rows:", updateRes);
    }
  } catch (e) {
    console.error("Exception:", e.message);
  }
}

run();
