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

async function analyzeRequisiciones() {
  console.log("Consultando todas las requisiciones...");
  let allReqs = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('requisiciones')
      .select('id, correlativo_req, items, facturas_url')
      .range(page * 500, (page + 1) * 500 - 1);
    
    if (error || !data || data.length === 0) break;
    allReqs = allReqs.concat(data);
    if (data.length < 500) break;
    page++;
  }

  console.log(`Total requisiciones descargadas: ${allReqs.length}`);

  const supplierContacts = new Map();
  const allHistoryKeys = new Set();
  const allItemKeys = new Set();

  allReqs.forEach(r => {
    const items = Array.isArray(r.items) ? r.items : [];
    items.forEach(it => {
      Object.keys(it).forEach(k => allItemKeys.add(k));

      const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
      hist.forEach(h => {
        Object.keys(h).forEach(k => allHistoryKeys.add(k));

        const provName = (h.proveedor_nombre || it.proveedor_nombre || it.proveedor || '').trim();
        if (!provName) return;

        const key = provName.toUpperCase();
        if (!supplierContacts.has(key)) {
          supplierContacts.set(key, {
            nombre: provName,
            rifs: new Set(),
            contactos: new Set(),
            telefonos: new Set(),
            correos: new Set(),
            ciudades: new Set(),
            direcciones: new Set(),
            totalCompras: 0
          });
        }

        const entry = supplierContacts.get(key);
        entry.totalCompras++;
        if (h.proveedor_rif) entry.rifs.add(h.proveedor_rif);
        if (h.rif) entry.rifs.add(h.rif);
        if (h.contacto) entry.contactos.add(h.contacto);
        if (h.persona_contacto) entry.contactos.add(h.persona_contacto);
        if (h.telefono) entry.telefonos.add(h.telefono);
        if (h.correo) entry.correos.add(h.correo);
        if (h.ciudad) entry.ciudades.add(h.ciudad);
        if (h.direccion) entry.direcciones.add(h.direccion);

        // Check item fields as well
        if (it.contacto) entry.contactos.add(it.contacto);
        if (it.telefono) entry.telefonos.add(it.telefono);
        if (it.correo) entry.correos.add(it.correo);
        if (it.ciudad) entry.ciudades.add(it.ciudad);
      });
    });
  });

  console.log("\nCampos encontrados en items:", Array.from(allItemKeys));
  console.log("Campos encontrados en historial_compras:", Array.from(allHistoryKeys));

  const list = Array.from(supplierContacts.values()).map(s => ({
    nombre: s.nombre,
    compras: s.totalCompras,
    rif: Array.from(s.rifs).join(', ') || 'Sin RIF',
    contacto: Array.from(s.contactos).join(', ') || 'Sin Contacto',
    telefono: Array.from(s.telefonos).join(', ') || 'Sin Teléfono',
    correo: Array.from(s.correos).join(', ') || 'Sin Correo',
    ciudad: Array.from(s.ciudades).join(', ') || 'Maracaibo'
  }));

  console.log(`\nTotal proveedores detectados en requisiciones: ${list.length}`);
  const conRif = list.filter(p => p.rif !== 'Sin RIF');
  const conContacto = list.filter(p => p.contacto !== 'Sin Contacto');
  const conTlf = list.filter(p => p.telefono !== 'Sin Teléfono');
  const conCorreo = list.filter(p => p.correo !== 'Sin Correo');

  console.log(`- Con RIF en compras: ${conRif.length}`);
  console.log(`- Con Contacto en compras: ${conContacto.length}`);
  console.log(`- Con Teléfono en compras: ${conTlf.length}`);
  console.log(`- Con Correo en compras: ${conCorreo.length}`);

  console.log("\nTop 25 Proveedores y su información actual:");
  console.table(list.slice(0, 25));
}

analyzeRequisiciones();
