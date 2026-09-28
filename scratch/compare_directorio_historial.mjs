import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
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

const normalizarNombreEmpresa = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[.,\-_/\\()&]/g, ' ')
    .replace(/\b(C\s*A|S\s*A|S\s*R\s*L|C\s*P\s*A|E\s*I\s*R\s*L|LLC|INC|GMBH|COMPANIA ANONIMA|SOCIEDAD ANONIMA|C\s*POR\s*A)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const sonProveedoresCoincidentes = (provObjOrNameA, provObjOrNameB) => {
  if (!provObjOrNameA || !provObjOrNameB) return false;

  const idA = typeof provObjOrNameA === 'object' ? provObjOrNameA?.id : null;
  const idB = typeof provObjOrNameB === 'object' ? provObjOrNameB?.id : null;
  if (idA && idB && String(idA) === String(idB)) return true;

  const rifA = typeof provObjOrNameA === 'object' ? (provObjOrNameA?.rif || '').replace(/[^0-9A-Z]/gi, '') : '';
  const rifB = typeof provObjOrNameB === 'object' ? (provObjOrNameB?.rif || '').replace(/[^0-9A-Z]/gi, '') : '';
  if (rifA && rifB && rifA.length >= 6 && rifA === rifB) return true;

  const nameA = typeof provObjOrNameA === 'object' ? (provObjOrNameA?.razon_social || provObjOrNameA?.nombre || '') : String(provObjOrNameA);
  const nameB = typeof provObjOrNameB === 'object' ? (provObjOrNameB?.razon_social || provObjOrNameB?.nombre || '') : String(provObjOrNameB);

  const cleanA = normalizarNombreEmpresa(nameA);
  const cleanB = normalizarNombreEmpresa(nameB);

  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB) return true;

  if (cleanA.length >= 5 && cleanB.length >= 5) {
    if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
      const minLen = Math.min(cleanA.length, cleanB.length);
      const maxLen = Math.max(cleanA.length, cleanB.length);
      if (minLen / maxLen >= 0.65) return true;
    }
  }

  return false;
};

async function run() {
  console.log("Iniciando sesión en Supabase...");
  const { data: auth, error: aErr } = await supabase.auth.signInWithPassword({
    email: 'jcontreras.totalclean@gmail.com',
    password: '123456'
  });

  if (aErr) {
    console.error("Error al iniciar sesión:", aErr.message);
    return;
  }
  console.log("Sesión iniciada con éxito como:", auth.user.email);

  // 1. Obtener proveedores del directorio
  const { data: provsDirectorio, error: pErr } = await supabase
    .from('proveedores')
    .select('*')
    .order('razon_social', { ascending: true });

  if (pErr) return console.error("Error cargando proveedores:", pErr);
  console.log(`\n📁 Proveedores registrados en Directorio: ${provsDirectorio.length}`);

  // 2. Obtener requisiciones aprobadas
  const { data: reqs, error: rErr } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, items')
    .eq('estado_aprobacion', 'aprobado_final');

  if (rErr) return console.error("Error cargando requisiciones:", rErr);

  // 3. Consolidar historial
  const comprasConsolidadas = [];
  reqs.forEach(r => {
    const items = Array.isArray(r.items) ? r.items : [];
    items.forEach(it => {
      const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
      hist.forEach(h => {
        if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
        const nombreProv = (h.proveedor_nombre || '').trim();
        if (!nombreProv) return;
        comprasConsolidadas.push({
          requisicion: r.correlativo_req || `REQ-${r.id}`,
          itemDescripcion: it.descripcion,
          proveedor_id: h.proveedor_id,
          proveedor_nombre: nombreProv,
          cantidad: Number(h.cant) || 0,
          pu: Number(h.pu) || 0,
          total: (Number(h.cant) || 0) * (Number(h.pu) || 0)
        });
      });
    });
  });

  console.log(`📊 Total transacciones de compra en historial: ${comprasConsolidadas.length}`);

  // 4. Agrupar por proveedor histórico
  const agrupado = {};
  comprasConsolidadas.forEach(c => {
    // Buscar si coincide con alguno del directorio
    const matched = provsDirectorio.find(p => sonProveedoresCoincidentes(p, { id: c.proveedor_id, razon_social: c.proveedor_nombre }));

    const key = matched ? `DIR_${matched.id}` : `HIST_${normalizarNombreEmpresa(c.proveedor_nombre) || c.proveedor_nombre.toUpperCase()}`;

    if (!agrupado[key]) {
      agrupado[key] = {
        key,
        enDirectorio: Boolean(matched),
        proveedorDirectorio: matched ? matched.razon_social : null,
        rifDirectorio: matched ? matched.rif : null,
        nombreHistorial: c.proveedor_nombre,
        comprasCount: 0,
        unidadesCompradas: 0,
        totalGastado: 0,
        requisiciones: new Set(),
        itemsEjemplo: []
      };
    }

    agrupado[key].comprasCount += 1;
    agrupado[key].unidadesCompradas += c.cantidad;
    agrupado[key].totalGastado += c.total;
    agrupado[key].requisiciones.add(c.requisicion);
    if (agrupado[key].itemsEjemplo.length < 2) {
      agrupado[key].itemsEjemplo.push(c.itemDescripcion);
    }
  });

  const todos = Object.values(agrupado);
  const noEnDirectorio = todos
    .filter(a => !a.enDirectorio)
    .sort((a, b) => b.totalGastado - a.totalGastado);

  console.log(`\n❌ Total proveedores en historial que NO están en Directorio: ${noEnDirectorio.length}`);
  console.log(`✅ Total proveedores en historial que SÍ están en Directorio: ${todos.length - noEnDirectorio.length}`);

  console.log("\n--- LISTA COMPLETA DE PROVEEDORES SIN FICHA EN DIRECTORIO ---");
  const listaFormateada = noEnDirectorio.map((p, idx) => ({
    N: idx + 1,
    'Nombre en Historial': p.nombreHistorial,
    'N° Compras': p.comprasCount,
    'Total Gastado ($)': p.totalGastado.toFixed(2),
    'Requisiciones': Array.from(p.requisiciones).slice(0, 3).join(', ')
  }));

  console.table(listaFormateada);

  fs.writeFileSync('scratch/proveedores_no_registrados.json', JSON.stringify(noEnDirectorio, null, 2));
  console.log("\nGuardado detalle en scratch/proveedores_no_registrados.json");
}

run();
