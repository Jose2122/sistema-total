import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let envUrl = '', envKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(envUrl, envKey);

const consolidarSoportesRequisicion = (facturas_url, items) => {
  const soportesMap = new Map();

  const arrayFacturas = Array.isArray(facturas_url) 
    ? facturas_url 
    : (facturas_url ? [facturas_url] : []);

  arrayFacturas.forEach((item) => {
    let url = '';
    let etiqueta = 'Archivo';
    if (typeof item === 'string') {
      if (item.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(item);
          url = parsed.url;
          etiqueta = parsed.etiqueta || 'Archivo';
        } catch {
          url = item;
        }
      } else {
        url = item;
      }
    } else if (item && typeof item === 'object') {
      url = item.url;
      etiqueta = item.etiqueta || 'Archivo';
    }

    if (url && typeof url === 'string' && url.length > 5) {
      soportesMap.set(url, { url, etiqueta: etiqueta || 'Archivo' });
    }
  });

  let safeItems = items;
  if (typeof safeItems === 'string') {
    try { safeItems = JSON.parse(safeItems); } catch { safeItems = []; }
  }
  (Array.isArray(safeItems) ? safeItems : []).forEach(it => {
    const itemDirectUrl = it?.factura_adjunto || it?.adjunto || it?.comprobante;
    if (itemDirectUrl && typeof itemDirectUrl === 'string' && itemDirectUrl.length > 5) {
      if (!soportesMap.has(itemDirectUrl)) {
        soportesMap.set(itemDirectUrl, {
          url: itemDirectUrl,
          etiqueta: `${it.codigo || it.nombre || it.descripcion || 'Ítem'}`.slice(0, 40)
        });
      }
    }

    (it?.historial_compras || []).forEach(h => {
      if (h.factura_url && typeof h.factura_url === 'string' && h.factura_url.length > 5) {
        const url = h.factura_url;
        if (!soportesMap.has(url)) {
          const docLabel = `${h.doc_tipo || 'FAC'}: ${h.doc_numero || ''}${h.proveedor_nombre ? ` (${h.proveedor_nombre})` : ''}`.trim();
          soportesMap.set(url, {
            url,
            etiqueta: docLabel || 'Factura / Comprobante'
          });
        }
      }
    });
  });

  return Array.from(soportesMap.values());
};

async function analyzeAll() {
  let allReqs = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('requisiciones')
      .select('id, correlativo_req, status_compra, estado_aprobacion, facturas_url, items')
      .order('id', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error:', error);
      break;
    }
    if (data && data.length > 0) {
      allReqs = allReqs.concat(data);
      if (data.length < pageSize) hasMore = false;
      else page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`Total requisiciones analizadas: ${allReqs.length}`);

  let reqsConDiscrepancia = [];
  let totalArchivosRecuperados = 0;

  for (const req of allReqs) {
    const rawFacturas = req.facturas_url || [];
    const countRaw = Array.isArray(rawFacturas) ? rawFacturas.length : (rawFacturas ? 1 : 0);
    const consolidados = consolidarSoportesRequisicion(req.facturas_url, req.items);
    
    if (consolidados.length > countRaw) {
      const diferencia = consolidados.length - countRaw;
      totalArchivosRecuperados += diferencia;
      reqsConDiscrepancia.push({
        id: req.id,
        correlativo: req.correlativo_req || `REQ-${req.id}`,
        enCabecera: countRaw,
        enTotalConsolidado: consolidados.length,
        recuperados: diferencia,
        archivos: consolidados
      });
    }
  }

  console.log(`\nRequisiciones que tenían archivos en renglones sin reflejarse en la cabecera: ${reqsConDiscrepancia.length}`);
  console.log(`Total de archivos que ahora se visualizan gracias a la consolidación: ${totalArchivosRecuperados}`);
  console.log('\nPrimeras 15 requisiciones detectadas con archivos recuperados:');
  reqsConDiscrepancia.slice(0, 15).forEach(r => {
    console.log(`- [${r.correlativo}] (ID: ${r.id}): Tenía ${r.enCabecera} en cabecera -> Ahora tiene ${r.enTotalConsolidado} soportes visibles (+${r.recuperados} recuperados)`);
  });
}

analyzeAll();
