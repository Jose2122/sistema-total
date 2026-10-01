import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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

async function check() {
  console.log("=== CHECKING REQUISICIONES (aprobado_final) ===");
  const { data: reqs, error } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, items, created_at, updated_at')
    .eq('estado_aprobacion', 'aprobado_final');
  
  if (error) return console.error("Error:", error);
  console.log(`Total requisiciones aprobadas: ${reqs?.length || 0}`);

  const provsEncontrados = new Map();
  const provsConRif = [];
  
  reqs.forEach(r => {
    (r.items || []).forEach(it => {
      (it.historial_compras || []).forEach(h => {
        if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
        const nom = (h.proveedor_nombre || '').trim();
        const rif = (h.proveedor_rif || h.rif || '').trim();
        const contacto = (h.contacto || h.persona_contacto || '').trim();
        const telf = (h.telefono || '').trim();
        const dir = (h.direccion || '').trim();
        const ciudad = (h.ciudad || '').trim();
        const ctas = h.cuentas_bancarias || null;

        if (nom) {
          const key = nom.toUpperCase();
          if (!provsEncontrados.has(key)) {
            provsEncontrados.set(key, {
              razon_social: nom,
              rif: rif || '',
              persona_contacto: contacto || '',
              telefono: telf || '',
              direccion: dir || '',
              ciudad: ciudad || 'Maracaibo',
              cuentas_bancarias: ctas,
              muestraReq: r.correlativo_req,
              fecha: h.fecha || h.fecha_pago || r.updated_at
            });
          } else {
            const existing = provsEncontrados.get(key);
            if (!existing.rif && rif) existing.rif = rif;
            if (!existing.persona_contacto && contacto) existing.persona_contacto = contacto;
            if (!existing.telefono && telf) existing.telefono = telf;
            if (!existing.direccion && dir) existing.direccion = dir;
            if (!existing.cuentas_bancarias && ctas) existing.cuentas_bancarias = ctas;
          }

          if (rif) {
            provsConRif.push({
              prov: nom,
              rif: rif,
              req: r.correlativo_req,
              fecha: h.fecha || h.fecha_pago || r.updated_at
            });
          }
        }
      });
    });
  });

  console.log(`Total proveedores distintos: ${provsEncontrados.size}`);
  const conRifList = Array.from(provsEncontrados.values()).filter(p => p.rif);
  console.log(`Proveedores con RIF en histórico: ${conRifList.length}`);
  console.log("\nLista de proveedores con RIF encontrados en histórico:");
  console.table(conRifList.map(p => ({
    razon_social: p.razon_social.substring(0, 30),
    rif: p.rif,
    contacto: p.persona_contacto,
    telefono: p.telefono,
    req: p.muestraReq
  })));

  // Guardar en JSON para análisis
  fs.writeFileSync('scratch/proveedores_extraidos_actualizados.json', JSON.stringify(Array.from(provsEncontrados.values()), null, 2));
}

check();
