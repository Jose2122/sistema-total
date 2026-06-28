import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read env variables
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Signing in...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'jcontreras.totalclean@gmail.com',
    password: '123456'
  });

  if (authError) {
    console.error("Sign in error:", authError.message);
    return;
  }
  console.log("Signed in as:", authData.user.email);

  // Generate random IDs for the transactions
  const txId1 = 'tx_' + Math.random().toString(36).substr(2, 9);
  const txId2 = 'tx_' + Math.random().toString(36).substr(2, 9);

  const testRequisicion = {
    correlativo_req: 'REQ-TEST-ALM',
    solicitante: 'José Contreras',
    gerencia: 'Operaciones',
    centro_costo: 'Maracaibo - Adm',
    estado_aprobacion: 'aprobado_final',
    fecha_emision: new Date().toISOString().split('T')[0],
    items: [
      {
        id: 1,
        descripcion: 'Taladro Percutor 1/2 Dewalt (Nuevo Flujo - Pendiente)',
        unidad: 'UNID',
        cantidad_pedida: 2,
        pu: 120,
        historial_compras: [
          {
            id: txId1,
            tipo: 'COMPRA',
            proveedor_nombre: 'Ferretería Industrial C.A.',
            doc_numero: 'FACT-001',
            fecha: new Date().toISOString().split('T')[0],
            metodo_pago: 'Efectivo',
            cant: 2,
            pu: 120,
            estatus_almacen: 'Por_Clasificar_Almacen',
            ubicacion_almacen: null,
            enviado_almacen: false
          }
        ]
      },
      {
        id: 2,
        descripcion: 'Cinta Métrica 5 metros Stanley (Nuevo Flujo - Ubicado)',
        unidad: 'UNID',
        cantidad_pedida: 5,
        pu: 15,
        historial_compras: [
          {
            id: txId2,
            tipo: 'COMPRA',
            proveedor_nombre: 'Ferretería El Tornillo',
            doc_numero: 'FACT-002',
            fecha: new Date().toISOString().split('T')[0],
            metodo_pago: 'Transferencia',
            cant: 5,
            pu: 15,
            estatus_almacen: 'Ubicado',
            ubicacion_almacen: 'Almacén Maracaibo - Sección B',
            enviado_almacen: true,
            fecha_entrada_almacen: new Date().toISOString()
          }
        ]
      },
      {
        id: 3,
        descripcion: 'Bombillos LED 12W (Legacy - Pendiente)',
        unidad: 'UNID',
        cantidad_pedida: 10,
        pu: 3.5,
        // En formato legado, el ítem mismo tiene los datos de compra
        estatus_almacen: 'Por_Clasificar_Almacen',
        enviado_almacen: false,
        proveedor: 'Suministros Eléctricos',
        doc_numero: 'FACT-LEGACY',
        cantidad_comprada: 10,
        pu: 3.5
      }
    ]
  };

  try {
    console.log("Cleaning up previous test requisitions...");
    await supabase.from('requisiciones').delete().eq('correlativo_req', 'REQ-TEST-ALM');

    console.log("Inserting test requisition...");
    const { data, error } = await supabase
      .from('requisiciones')
      .insert([testRequisicion])
      .select();

    if (error) throw error;

    console.log("\n--- TEST REQUISITION INSERTED SUCCESSFULLY ---");
    console.log("ID:", data[0].id);
    console.log("Correlativo:", data[0].correlativo_req);
    console.log("Status Aprobación:", data[0].estado_aprobacion);
    console.log("Items count:", data[0].items.length);
    console.log("\nUsted puede ir al panel de Almacén y verá:\n");
    console.log("1. En la pestaña 'Pendientes de Ingreso':");
    console.log("   - Taladro Percutor 1/2 Dewalt (REQ-TEST-ALM) - Factura FACT-001");
    console.log("   - Bombillos LED 12W (REQ-TEST-ALM) - Factura FACT-LEGACY");
    console.log("2. En la pestaña 'Ingresados a Almacén':");
    console.log("   - Cinta Métrica 5 metros Stanley (REQ-TEST-ALM) - Ubicado en: Almacén Maracaibo - Sección B");
  } catch (err) {
    console.error("Error inserting test data:", err.message);
  }
}

run();
