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

async function extractAll() {
  console.log("Extrayendo requisiciones...");
  const { data: reqs, error } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, fecha_emision, items')
    .eq('estado_aprobacion', 'aprobado_final');

  if (error) return console.error("Error:", error);

  const proveedoresMap = new Map();

  reqs.forEach(r => {
    const items = Array.isArray(r.items) ? r.items : [];
    items.forEach(it => {
      const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
      hist.forEach(h => {
        if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
        const nombre = (h.proveedor_nombre || '').trim();
        if (!nombre) return;

        const provId = h.proveedor_id || null;
        const cant = Number(h.cant) || 0;
        const pu = Number(h.pu) || 0;
        const total = cant * pu;

        if (!proveedoresMap.has(nombre.toUpperCase())) {
          proveedoresMap.set(nombre.toUpperCase(), {
            nombreOriginal: nombre,
            proveedorId: provId,
            transacciones: 0,
            unidades: 0,
            totalGastado: 0,
            requisiciones: new Set(),
            itemsEjemplo: new Set()
          });
        }

        const entry = proveedoresMap.get(nombre.toUpperCase());
        entry.transacciones += 1;
        entry.unidades += cant;
        entry.totalGastado += total;
        entry.requisiciones.add(r.correlativo_req || `REQ-${r.id}`);
        if (it.descripcion && entry.itemsEjemplo.size < 3) {
          entry.itemsEjemplo.add(it.descripcion.substring(0, 40));
        }
        if (!entry.proveedorId && provId) {
          entry.proveedorId = provId;
        }
      });
    });
  });

  const list = Array.from(proveedoresMap.values()).sort((a, b) => b.totalGastado - a.totalGastado);

  console.log(`\nTotal proveedores detectados en el Historial: ${list.length}`);

  // Filtrar los que no tienen proveedorId o cuyo proveedorId fue asignado como temporal/manual
  // O mostrar la lista completa clasificada
  fs.writeFileSync('scratch/historial_proveedores_completo.json', JSON.stringify(list.map(p => ({
    ...p,
    requisiciones: Array.from(p.requisiciones),
    itemsEjemplo: Array.from(p.itemsEjemplo)
  })), null, 2));

  console.log("\nGuardado en scratch/historial_proveedores_completo.json");
  console.log("\nTop 40 Proveedores por Gasto Total en el Historial:");
  console.table(list.slice(0, 40).map((p, idx) => ({
    '#': idx + 1,
    'Proveedor': p.nombreOriginal,
    'ID Asociado': p.proveedorId || 'Sin ID (Texto Libre)',
    'Compras': p.transacciones,
    'Total ($)': `$ ${p.totalGastado.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`
  })));
}

extractAll();
