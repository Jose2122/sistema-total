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

async function checkContacts() {
  console.log("=== 1. VERIFICANDO TABLA PROVEEDORES EN SUPABASE ===");
  const { data: dbProvs, error: dbErr } = await supabase
    .from('proveedores')
    .select('*')
    .order('razon_social', { ascending: true });

  if (dbErr) {
    console.error("Error al consultar proveedores:", dbErr);
  } else {
    console.log(`Total proveedores en Supabase: ${dbProvs.length}`);
    const conContacto = dbProvs.filter(p => p.persona_contacto || p.contacto_nombre || p.contacto);
    const conTelefono = dbProvs.filter(p => p.telefono);
    const conCorreo = dbProvs.filter(p => p.correo);
    const conRif = dbProvs.filter(p => p.rif);
    console.log(`- Con RIF: ${conRif.length}`);
    console.log(`- Con Persona de Contacto: ${conContacto.length}`);
    console.log(`- Con Teléfono: ${conTelefono.length}`);
    console.log(`- Con Correo: ${conCorreo.length}`);

    console.log("\nMuestra de Proveedores en DB (Primeros 15):");
    console.table(dbProvs.slice(0, 15).map(p => ({
      ID: p.id,
      'Razón Social': p.razon_social ? p.razon_social.substring(0, 28) : '',
      RIF: p.rif || 'Sin RIF',
      Contacto: p.persona_contacto || p.contacto_nombre || 'Sin contacto',
      Teléfono: p.telefono || 'Sin tlf',
      Correo: p.correo || 'Sin correo',
      Ciudad: p.ciudad || p.localizacion || ''
    })));
  }

  console.log("\n=== 2. VERIFICANDO CONTACTOS EN HISTORIAL DE REQUISICIONES ===");
  const { data: reqs, error: reqErr } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, items')
    .eq('estado_aprobacion', 'aprobado_final')
    .limit(300);

  if (reqErr) {
    console.error("Error al consultar requisiciones:", reqErr);
  } else {
    let totalHist = 0;
    let conContactoHist = 0;
    let conTlfHist = 0;
    const mapaContactosHist = new Map();

    reqs.forEach(r => {
      const items = Array.isArray(r.items) ? r.items : [];
      items.forEach(it => {
        const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
        hist.forEach(h => {
          if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
          const nom = (h.proveedor_nombre || '').trim();
          if (!nom) return;
          totalHist++;
          if (h.contacto || h.persona_contacto) conContactoHist++;
          if (h.telefono) conTlfHist++;

          if (!mapaContactosHist.has(nom.toUpperCase())) {
            mapaContactosHist.set(nom.toUpperCase(), {
              nombre: nom,
              rif: h.proveedor_rif || '',
              contacto: h.contacto || h.persona_contacto || '',
              telefono: h.telefono || '',
              correo: h.correo || '',
              ciudad: h.ciudad || ''
            });
          } else {
            const cur = mapaContactosHist.get(nom.toUpperCase());
            if (!cur.contacto && (h.contacto || h.persona_contacto)) cur.contacto = h.contacto || h.persona_contacto;
            if (!cur.telefono && h.telefono) cur.telefono = h.telefono;
            if (!cur.correo && h.correo) cur.correo = h.correo;
            if (!cur.rif && h.proveedor_rif) cur.rif = h.proveedor_rif;
          }
        });
      });
    });

    console.log(`Total registros en historial: ${totalHist}`);
    console.log(`Proveedores únicos en historial: ${mapaContactosHist.size}`);
    const histArray = Array.from(mapaContactosHist.values());
    const histConContacto = histArray.filter(h => h.contacto);
    const histConTlf = histArray.filter(h => h.telefono);
    console.log(`- Con Contacto: ${histConContacto.length} de ${histArray.length}`);
    console.log(`- Con Teléfono: ${histConTlf.length} de ${histArray.length}`);

    console.log("\nMuestra de contactos encontrados en Requisiciones (Primeros 15 con contacto):");
    console.table(histConContacto.slice(0, 15));
  }
}

checkContacts();
