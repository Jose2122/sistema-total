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

const key = env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(env.VITE_SUPABASE_URL, key);

async function run() {
  console.log("=== INSPECTING PROVEEDORES DATABASE ===");

  // 1. Get all from proveedores table
  const { data: provs, error: provErr, count } = await supabase
    .from('proveedores')
    .select('*', { count: 'exact' });

  if (provErr) {
    console.error("Error fetching proveedores:", provErr);
    return;
  }

  console.log(`Total rows in 'proveedores' table: ${provs.length}`);

  // Look for PRIETO or ENARGER
  const prietoMatches = provs.filter(p => p.razon_social?.toUpperCase().includes('PRIETO'));
  console.log("\nMatches for 'PRIETO' in proveedores table:", prietoMatches);

  const enargerMatches = provs.filter(p => p.razon_social?.toUpperCase().includes('ENARG'));
  console.log("\nMatches for 'ENARGER' in proveedores table:", enargerMatches);

  // 2. Look in requisiciones items historial_compras
  const { data: reqs, error: reqErr } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, items')
    .eq('estado_aprobacion', 'aprobado_final');

  if (reqErr) {
    console.error("Error fetching requisiciones:", reqErr);
    return;
  }

  console.log(`\nAnalyzing ${reqs.length} approved requisiciones for purchase history...`);
  const historicalNames = new Map();

  reqs.forEach(r => {
    const items = Array.isArray(r.items) ? r.items : [];
    items.forEach(it => {
      const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
      hist.forEach(h => {
        if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
        const name = h.proveedor_nombre || 'Desconocido';
        const id = h.proveedor_id || null;
        if (!historicalNames.has(name)) {
          historicalNames.set(name, { count: 0, total: 0, id: id, sampleReq: r.correlativo_req });
        }
        const entry = historicalNames.get(name);
        entry.count += 1;
        entry.total += (Number(h.cant) || 0) * (Number(h.pu) || 0);
      });
    });
  });

  console.log(`Total distinct provider names in purchase history: ${historicalNames.size}`);

  console.log("\n--- Checking which historical providers are in 'proveedores' table ---");
  const missingInTable = [];
  const foundInTable = [];

  for (const [histName, info] of historicalNames.entries()) {
    const match = provs.find(p => {
      if (info.id && p.id === info.id) return true;
      if (p.razon_social && p.razon_social.trim().toUpperCase() === histName.trim().toUpperCase()) return true;
      return false;
    });

    if (match) {
      foundInTable.push({ histName, tableId: match.id, tableName: match.razon_social, rif: match.rif });
    } else {
      missingInTable.push({ histName, count: info.count, total: info.total, sampleReq: info.sampleReq });
    }
  }

  console.log(`Found in proveedores table: ${foundInTable.length}`);
  console.log(`NOT found in proveedores table: ${missingInTable.length}`);

  console.log("\nList of Historical Providers NOT in 'proveedores' table:");
  console.table(missingInTable);
}

run();
