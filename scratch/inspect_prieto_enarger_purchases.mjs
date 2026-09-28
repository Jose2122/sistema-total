import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = match[2].replace(/['"\r]/g, '').trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspectPurchases() {
  console.log("=== INSPECTING PURCHASES FOR PRIETO AND ENARGER ===");

  const { data: reqs, error } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, fecha_emision, solicitante, gerencia, items')
    .eq('estado_aprobacion', 'aprobado_final');

  if (error) return console.error(error);

  const prietoPurchases = [];
  const enargerPurchases = [];
  const allHistoricalVendors = new Map();

  reqs.forEach(r => {
    const items = Array.isArray(r.items) ? r.items : [];
    items.forEach(it => {
      const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
      hist.forEach(h => {
        if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
        const name = (h.proveedor_nombre || '').trim();
        const provId = h.proveedor_id || null;

        if (!allHistoricalVendors.has(name)) {
          allHistoricalVendors.set(name, { count: 0, total: 0, provId });
        }
        const v = allHistoricalVendors.get(name);
        v.count += 1;
        v.total += (Number(h.cant) || 0) * (Number(h.pu) || 0);

        if (name.toUpperCase().includes('PRIETO')) {
          prietoPurchases.push({
            req: r.correlativo_req,
            item: it.descripcion,
            cant: h.cant,
            pu: h.pu,
            total: (Number(h.cant) || 0) * (Number(h.pu) || 0),
            proveedor_nombre: h.proveedor_nombre,
            proveedor_id: h.proveedor_id,
            fecha: h.fecha || r.fecha_emision
          });
        }

        if (name.toUpperCase().includes('ENARG')) {
          enargerPurchases.push({
            req: r.correlativo_req,
            item: it.descripcion,
            cant: h.cant,
            pu: h.pu,
            total: (Number(h.cant) || 0) * (Number(h.pu) || 0),
            proveedor_nombre: h.proveedor_nombre,
            proveedor_id: h.proveedor_id,
            fecha: h.fecha || r.fecha_emision
          });
        }
      });
    });
  });

  console.log(`\n--- PRIETO PURCHASES (${prietoPurchases.length}) ---`);
  console.table(prietoPurchases);

  console.log(`\n--- ENARGER PURCHASES (${enargerPurchases.length}) ---`);
  console.table(enargerPurchases);

  console.log(`\n--- ALL HISTORICAL VENDORS (${allHistoricalVendors.size}) ---`);
  const sorted = Array.from(allHistoricalVendors.entries()).sort((a, b) => b[1].total - a[1].total);
  console.log("Top 20 historical vendors by spend:");
  console.table(sorted.slice(0, 20).map(([name, data]) => ({
    proveedor: name,
    transacciones: data.count,
    totalGastado: data.total,
    proveedor_id: data.provId
  })));
}

inspectPurchases();
