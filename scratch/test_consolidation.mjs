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

    if (url && url.length > 5) {
      soportesMap.set(url, { url, etiqueta });
    }
  });

  (items || []).forEach(it => {
    (it.historial_compras || []).forEach(h => {
      if (h.factura_url && typeof h.factura_url === 'string' && h.factura_url.length > 5) {
        const url = h.factura_url;
        if (!soportesMap.has(url)) {
          const docLabel = `${h.doc_tipo || 'DOC'}: ${h.doc_numero || ''}${h.proveedor_nombre ? ` (${h.proveedor_nombre})` : ''}`.trim();
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

async function test() {
  const { data } = await supabase.from('requisiciones').select('*').eq('id', 682).single();
  const consolidados = consolidarSoportesRequisicion(data.facturas_url, data.items);
  console.log('Archivos consolidados para RR-MTT-26-0271:', consolidados.length);
  console.log(JSON.stringify(consolidados, null, 2));
}
test();
