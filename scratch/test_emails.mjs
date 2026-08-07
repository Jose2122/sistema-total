import fs from 'fs';
import path from 'path';

// Determinar si probamos de forma local o remota
const isLocal = process.argv.includes('--local');

// Buscar variables en .env.local o .env
let supabaseUrl = 'https://pugwgdqgsqjtbeouodpo.supabase.co';
let anonKey = '';

try {
  const envPath = fs.existsSync('.env.local') ? '.env.local' : (fs.existsSync('.env') ? '.env' : null);
  if (envPath) {
    console.log(`Cargando configuración desde ${envPath}...`);
    const envContent = fs.readFileSync(path.resolve(envPath), 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        if (key === 'VITE_SUPABASE_URL') supabaseUrl = value.trim();
        if (key === 'VITE_SUPABASE_ANON_KEY') anonKey = value.trim();
      }
    });
  }
} catch (e) {
  console.warn('No se pudo leer el archivo .env o .env.local. Usando valores por defecto.', e.message);
}

// Configurar URL base y cabeceras
const baseUrl = isLocal ? 'http://127.0.0.1:54321/functions/v1' : `${supabaseUrl}/functions/v1`;
console.log(`\n======================================================`);
console.log(`ENTORNO DE PRUEBA: ${isLocal ? 'LOCAL (Deno serve)' : 'REMOTO (Supabase Cloud)'}`);
console.log(`URL Base: ${baseUrl}`);
console.log(`======================================================\n`);

const headers = {
  'Content-Type': 'application/json',
};

if (anonKey) {
  headers['Authorization'] = `Bearer ${anonKey}`;
  headers['apikey'] = anonKey;
}

// 1. Datos ficticios para Requisición
const reqPayload = {
  to: [
    'jcontrerasbriceno@gmail.com',
    'jcontreras.totalclean@gmail.com',
    'cvega.totalclean@gmail.com',
    'cvega@totalclean.com'
  ], // Destinatarios de prueba (Jose + Carlos)
  solicitante: 'Juan Contreras (Prueba)',
  gerencia: 'Mantenimiento y Equipos',
  centro_costo: 'MCBO-TC',
  fecha_requerida: '2026-08-10',
  prioridad: 'Alta',
  justificacion: 'Se requiere la compra urgente de materiales para el mantenimiento preventivo de los equipos en la sede principal.',
  observaciones: 'Por favor verificar las especificaciones técnicas del filtro de aire con el proveedor antes de facturar.',
  items: [
    { cant: 3, descripcion: 'Filtros de Aire Acondicionado 12000 BTU' },
    { cant: 10, descripcion: 'Bombillos LED 12W 110V' },
    { cant: 2, descripcion: 'Cinta Aislante Negra Cobra' }
  ]
};


// 2. Datos ficticios para Ticket de Pago
const ticketPayload = {
  to: ['jcontreras.totalclean@gmail.com'], // Destinatario unitario de prueba
  codigo_control: 'TP-2026-0089',
  gerente_nombre: 'Jose Contreras (Prueba)',
  departamento: 'Administración',
  centro_costo: 'CCS-ADMIN',
  beneficiario: 'Distribuidora Industrial Sol, C.A.',
  total_usd: 385.50,
  clasificacion_admin: 'Transferencia Zelle',
  solicitud_ref: 'Proyecto Mantenimiento Anual 2026',
  justificacion: 'Pago correspondiente a la adquisición de repuestos y herramientas industriales menores para las cuadrillas de campo.',
  items: [
    { cant: 1, descripcion: 'Taladro Percutor Dewalt 20V Max', total: 180.00 },
    { cant: 5, descripcion: 'Juego de Mechas para Concreto e Hierro', total: 45.50 },
    { cant: 2, descripcion: 'Esmeril Angular Metabo 4 1/2"', total: 160.00 }
  ]
};

async function ejecutarPruebas() {
  // Probar Requisiciones
  console.log('--- Probando enviar-notificacion-req ---');
  try {
    const url = `${baseUrl}/enviar-notificacion-req`;
    console.log(`POST a: ${url}`);
    
    // Imprimir comando curl de ayuda
    const curlHeaders = Object.entries(headers).map(([k, v]) => `-H "${k}: ${v.substring(0, 30)}..."`).join(' ');
    console.log(`[cURL Equivalente]: curl -X POST ${url} -H "Content-Type: application/json" -H "Authorization: Bearer \$ANON_KEY" -d '${JSON.stringify(reqPayload)}'\n`);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(reqPayload),
    });

    const status = res.status;
    const bodyText = await res.text();
    console.log(`Resultado: Código de Respuesta = ${status}`);
    console.log(`Respuesta del Servidor:\n`, bodyText);
  } catch (err) {
    console.error('Error al probar enviar-notificacion-req:', err.message);
  }

  console.log('\n----------------------------------------\n');

  // Probar Ticket de Pago
  console.log('--- Probando send-ticket-pago-email ---');
  try {
    const url = `${baseUrl}/send-ticket-pago-email`;
    console.log(`POST a: ${url}`);
    
    // Imprimir comando curl de ayuda
    const curlHeaders = Object.entries(headers).map(([k, v]) => `-H "${k}: ${v.substring(0, 30)}..."`).join(' ');
    console.log(`[cURL Equivalente]: curl -X POST ${url} -H "Content-Type: application/json" -H "Authorization: Bearer \$ANON_KEY" -d '${JSON.stringify(ticketPayload)}'\n`);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(ticketPayload),
    });

    const status = res.status;
    const bodyText = await res.text();
    console.log(`Resultado: Código de Respuesta = ${status}`);
    console.log(`Respuesta del Servidor:\n`, bodyText);
  } catch (err) {
    console.error('Error al probar send-ticket-pago-email:', err.message);
  }
}

ejecutarPruebas();
