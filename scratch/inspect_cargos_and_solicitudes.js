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
    console.log('--- DB INSPECTION ---');
    // Get sample solicitudes_fondos
    const { data: sols, error: solErr } = await supabase.from('solicitudes_fondos').select('*').limit(1);
    if (solErr) {
      console.error('Error fetching solicitudes_fondos:', solErr);
    } else if (sols && sols.length > 0) {
      console.log('solicitudes_fondos keys:', Object.keys(sols[0]));
      console.log('solicitudes_fondos sample:', sols[0]);
    } else {
      console.log('No solicitudes_fondos rows.');
    }

    // Get Hilda and Johannel profiles
    const { data: perfiles, error: perfErr } = await supabase
      .from('perfiles')
      .select('*')
      .or('nombre.ilike.%hilda%,nombre.ilike.%johannel%');
    
    if (perfErr) {
      console.error('Error fetching perfiles:', perfErr);
    } else {
      console.log('Perfiles for Hilda/Johannel:', perfiles);
    }

    // Get all unique values in departamento / gerencia column of perfiles
    const { data: allPerfiles, error: allPerfErr } = await supabase
      .from('perfiles')
      .select('departamento, rol, activo')
      .eq('activo', true);
    
    if (allPerfErr) {
      console.error('Error fetching all perfiles:', allPerfErr);
    } else {
      const depts = new Set();
      allPerfiles.forEach(p => depts.add(p.departamento));
      console.log('Unique departamentos in perfiles:', Array.from(depts));
    }

  } catch (err) {
    console.error('Fatal error:', err);
  }
}

run();
