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

async function testDirectorySyncInRequisiciones() {
  console.log("Testing search for existing SYS-DIRECTORIO...");
  const { data: existing, error: sErr } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, items')
    .eq('correlativo_req', 'SYS-DIRECTORIO-PROVEEDORES-SYNC')
    .limit(1);

  console.log("Existing search:", existing, sErr);

  if (!existing || existing.length === 0) {
    console.log("Inserting SYS-DIRECTORIO-PROVEEDORES-SYNC...");
    const { data: inserted, error: iErr } = await supabase
      .from('requisiciones')
      .insert([{
        correlativo_req: 'SYS-DIRECTORIO-PROVEEDORES-SYNC',
        estado_aprobacion: 'sistema_interno',
        departamento: 'SISTEMA',
        usuario_id: '00000000-0000-0000-0000-000000000000',
        items: [{
          tipo: 'DIRECTORIO_CENTRAL_PROVEEDORES',
          ultima_actualizacion: new Date().toISOString(),
          proveedores: [
            {
              id: 'PROV-FERRETERIA-ROCCA',
              rif: 'J-07040810-3',
              razon_social: 'FERRETERIA ROCCA',
              persona_contacto: 'ferreteria rocca',
              contacto_nombre: 'ferreteria rocca',
              telefono: '0414-569-5485',
              correo: '',
              direccion: 'AV 23 SECTOR 1 DE MAYO 79 -40',
              ciudad: 'Maracaibo',
              localizacion: 'Maracaibo',
              categoria: ['FERRETERÍA'],
              creado_por_nombre: 'Renny Maestre',
              actualizado_por_nombre: 'Renny Maestre',
              status: true
            },
            {
              id: 298,
              rif: 'J-00020200-1',
              razon_social: 'FARMATODO',
              persona_contacto: 'farmatodo',
              contacto_nombre: 'farmatodo',
              telefono: '0414869632',
              correo: '',
              direccion: 'AV LOS GUAYABITOS C EXPRESO BARUTA NIVEL 5 OF UNICA URB LA TRINIDAD',
              ciudad: 'Maracaibo',
              localizacion: 'Maracaibo',
              categoria: ['SERVICIO MEDICO'],
              creado_por_nombre: 'Renny Maestre',
              actualizado_por_nombre: 'Renny Maestre',
              status: true
            },
            {
              id: 'PROV-FARMAEXPRESS-C2',
              rif: 'J-50503725-0',
              razon_social: 'FARMAEXPRESS C2',
              persona_contacto: 'farmaexpress',
              contacto_nombre: 'farmaexpress',
              telefono: '04145699632',
              correo: '',
              direccion: 'AV CIRCUNVALACION 2 ENTRE CALLE 97 Y 97A C SAN TARCITO',
              ciudad: 'Maracaibo',
              localizacion: 'Maracaibo',
              categoria: ['OTROS'],
              creado_por_nombre: 'Renny Maestre',
              actualizado_por_nombre: 'Renny Maestre',
              status: true
            },
            {
              id: 'PROV-FARMAEXPRESS-CA',
              rif: 'J-58632369-5',
              razon_social: 'FARMAEXPRESS C.A',
              persona_contacto: 'FARMAEXPRESS',
              contacto_nombre: 'FARMAEXPRESS',
              telefono: '0424658963',
              correo: '',
              direccion: 'AV CIRCUNVALACION 2 ENTRE CALLE 97 Y 97A CC SAN TARCITO PB',
              ciudad: 'Maracaibo',
              localizacion: 'Maracaibo',
              categoria: ['SERVICIO MEDICO'],
              creado_por_nombre: 'Analista Compras',
              actualizado_por_nombre: 'Analista Compras',
              status: true
            }
          ]
        }]
      }])
      .select();

    console.log("Insert result:", inserted, iErr);
  } else {
    console.log("Already exists, testing update...");
    const { data: updated, error: uErr } = await supabase
      .from('requisiciones')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('id', existing[0].id)
      .select();
    console.log("Update result:", updated, uErr);
  }
}

testDirectorySyncInRequisiciones();
