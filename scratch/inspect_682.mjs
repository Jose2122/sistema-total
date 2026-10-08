import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
let envUrl = '', envKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) envUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) envKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(envUrl, envKey);

async function check() {
  const { data } = await supabase.from('requisiciones').select('*').eq('id', 682).single();
  console.log('Requisicion 682 (RR-MTT-26-0271):');
  console.log('facturas_url in root:', data.facturas_url);
  
  const allUrls = new Set();
  if (data.facturas_url) {
    data.facturas_url.forEach(f => {
      try {
        const parsed = typeof f === 'string' && f.startsWith('{') ? JSON.parse(f) : f;
        allUrls.add(parsed.url || parsed);
      } catch (e) {
        allUrls.add(f);
      }
    });
  }

  (data.items || []).forEach((it, i) => {
    console.log(`\nItem ${i+1}: ${it.nombre || it.descripcion}`);
    (it.historial_compras || []).forEach((h, hi) => {
      console.log(`  Compra ${hi+1}: ${h.doc_tipo} ${h.doc_numero} - Prov: ${h.proveedor_nombre} - URL: ${h.factura_url}`);
    });
  });
}
check();
