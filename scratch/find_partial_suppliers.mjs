import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '').replace('\r', '');
    env[k] = v;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: reqs, error } = await supabase.from('requisiciones').select('id, correlativo_req, items');
  if (error) {
    console.error('Error:', error);
    return;
  }

  const searchTerms = [
    '07034507', '7026566', 'TRUMELTARCA', '0431884', '31093193',
    'LORUSSO', 'URDANETA', 'LARA', 'TICKETVEN', 'VENE-TRUCK',
    'MEZULCA', 'VIGILAME', 'SERMAKOL', 'ORIENTE', 'GRUAS RM',
    'WL DISE', 'YOANNY', 'ZULEIKA'
  ];

  const results = {};
  reqs.forEach(r => {
    (r.items || []).forEach(it => {
      (it.historial_compras || []).forEach(h => {
        searchTerms.forEach(term => {
          const hStr = JSON.stringify(h);
          if (hStr.toLowerCase().includes(term.toLowerCase())) {
            results[term] = results[term] || [];
            results[term].push({ req: r.correlativo_req, ...h });
          }
        });
      });
    });
  });

  console.log('--- FOUND SEARCH RESULTS ---');
  for (const k in results) {
    console.log(`\n=== TERM: ${k} ===`);
    results[k].forEach(item => {
      console.log(`  Prov: ${item.proveedor_nombre} | RIF: ${item.proveedor_rif} | Contacto: ${item.contacto} | Tel: ${item.telefono} | Correo: ${item.correo} | Dir: ${item.direccion}`);
    });
  }
}

run();
