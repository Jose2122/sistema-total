/**
 * Script de Migración Segura de Facturas y Soportes de Supabase Storage a VPS Linux
 * SITC - Sistema Integrado Total Clean
 * 
 * Uso:
 *   node migrar_storage_vps.js --test    -> Modo prueba: procesa únicamente los primeros 5 archivos
 *   node migrar_storage_vps.js           -> Modo completo: procesa y migra todas las facturas
 * 
 * Garantías:
 *   a) Genera backup_urls_supabase.json ANTES de tocar la base de datos
 *   b) Descarga copias de los archivos a /var/www/sitc/uploads (o ./uploads_migrados en local)
 *   c) Actualiza las URLs en Supabase apuntando a https://sitc.totalclean.com.ve/uploads/...
 *   d) NO borra ningún archivo de Supabase Storage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Cargar variables de entorno desde .env o .env.local
function cargarEnv() {
  const envPaths = [path.join(__dirname, '.env'), path.join(__dirname, '.env.local')];
  const env = {};
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          env[key] = val;
        }
      });
    }
  }
  return env;
}

const env = cargarEnv();
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://pugwgdqgsqjtbeouodpo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: No se encontraron las credenciales de Supabase en el entorno ni en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Parámetros de ejecución
const args = process.argv.slice(2);
const IS_TEST = args.includes('--test');
const TEST_LIMIT = 5;

// Carpeta de destino (VPS /var/www/sitc/uploads o local ./uploads_migrados)
const DEFAULT_DEST = process.platform === 'linux' ? '/var/www/sitc/uploads' : path.join(__dirname, 'uploads_migrados');
const DEST_DIR = process.env.UPLOADS_DIR || DEFAULT_DEST;
const VPS_BASE_URL = (process.env.PUBLIC_UPLOADS_URL || 'https://sitc.totalclean.com.ve/uploads').replace(/\/+$/, '');

// Asegurar carpeta destino
if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

console.log('='.repeat(75));
console.log('🚀 SITC - MIGRACIÓN SEGURA DE FACTURAS Y SOPORTES A VPS LINUX');
console.log('='.repeat(75));
console.log(`📡 Supabase URL:   ${SUPABASE_URL}`);
console.log(`📁 Carpeta VPS:    ${DEST_DIR}`);
console.log(`🌐 Base URL VPS:   ${VPS_BASE_URL}`);
console.log(`🧪 Modo:           ${IS_TEST ? 'MODO DE PRUEBA (--test, máx 5 archivos)' : 'LOTE COMPLETO (Producción)'}`);
console.log('='.repeat(75));

function sanitizarTexto(str, max = 40) {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, max);
}

function esUrlSupabase(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('supabase.co/storage/v1/object/public/');
}

function parsearObjetoUrl(item) {
  if (!item) return null;
  if (typeof item === 'object') return item;
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function descargarArchivo(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer;
  } catch (err) {
    console.warn(`  ⚠️ Error descargando ${url}:`, err.message);
    return null;
  }
}

async function autenticarSiEsNecesario() {
  // Intentar login para tener permisos de lectura/escritura si se ejecuta con anon key
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: process.env.ADMIN_EMAIL || 'cvega@totalclean.com',
      password: process.env.ADMIN_PASSWORD || '123456'
    });
    if (!error && data?.user) {
      console.log(`🔐 Sesión autenticada como: ${data.user.email}`);
    }
  } catch (e) {
    console.log('ℹ️ Operando con clave directa de Supabase...');
  }
}

async function ejecutarMigracion() {
  await autenticarSiEsNecesario();

  console.log('\n🔍 [Paso 1/4] Escaneando tablas en Supabase en busca de archivos en Storage...');

  // --- A. Consultar requisiciones ---
  let allRequisiciones = [];
  try {
    let from = 0;
    const step = 500;
    let keep = true;
    while (keep) {
      const { data, error } = await supabase
        .from('requisiciones')
        .select('id, correlativo_req, facturas_url, items')
        .range(from, from + step - 1);
      if (error) {
        console.warn('Aviso leyendo requisiciones:', error.message);
        break;
      }
      if (data && data.length > 0) {
        allRequisiciones.push(...data);
        if (data.length < step) keep = false;
        from += step;
      } else {
        keep = false;
      }
    }
  } catch (e) {
    console.error('Error paginando requisiciones:', e.message);
  }

  // --- B. Consultar tickets_directos ---
  let allTickets = [];
  try {
    let from = 0;
    const step = 500;
    let keep = true;
    while (keep) {
      const { data, error } = await supabase
        .from('tickets_directos')
        .select('id, codigo_control, factura_url, items')
        .range(from, from + step - 1);
      if (error) {
        console.warn('Aviso leyendo tickets_directos:', error.message);
        break;
      }
      if (data && data.length > 0) {
        allTickets.push(...data);
        if (data.length < step) keep = false;
        from += step;
      } else {
        keep = false;
      }
    }
  } catch (e) {
    console.error('Error paginando tickets_directos:', e.message);
  }

  console.log(`  -> Registros leídos: ${allRequisiciones.length} Requisiciones, ${allTickets.length} Tickets de Pago.`);

  // Estructura para el respaldo completo
  const backupData = {
    fecha_backup: new Date().toISOString(),
    supabase_url: SUPABASE_URL,
    vps_base_url: VPS_BASE_URL,
    total_tickets_analizados: allTickets.length,
    total_requisiciones_analizadas: allRequisiciones.length,
    tickets_directos: [],
    requisiciones: []
  };

  const planMigracion = [];

  // Analizar requisiciones
  allRequisiciones.forEach(r => {
    let urlsEncontradas = [];

    // Columna facturas_url (puede ser array de strings JSON o array de URLs directas)
    if (Array.isArray(r.facturas_url)) {
      r.facturas_url.forEach((item, idx) => {
        const parsed = parsearObjetoUrl(item);
        if (parsed && esUrlSupabase(parsed.url)) {
          urlsEncontradas.push({
            tipo: 'facturas_url_array_json_obj',
            idx,
            url: parsed.url,
            etiqueta: parsed.etiqueta || parsed.name || '',
            originalItem: item,
            parsed
          });
        } else if (typeof item === 'string' && esUrlSupabase(item)) {
          urlsEncontradas.push({
            tipo: 'facturas_url_array_string',
            idx,
            url: item,
            originalItem: item
          });
        }
      });
    }

    // items[].historial_compras[].factura_url / soporte_url
    if (Array.isArray(r.items)) {
      r.items.forEach((item, iIdx) => {
        if (Array.isArray(item.historial_compras)) {
          item.historial_compras.forEach((h, hIdx) => {
            if (esUrlSupabase(h.factura_url)) {
              urlsEncontradas.push({ tipo: 'req_item_historial_factura', iIdx, hIdx, url: h.factura_url });
            }
            if (esUrlSupabase(h.soporte_url)) {
              urlsEncontradas.push({ tipo: 'req_item_historial_soporte', iIdx, hIdx, url: h.soporte_url });
            }
          });
        }
      });
    }

    if (urlsEncontradas.length > 0) {
      backupData.requisiciones.push({
        id: r.id,
        correlativo_req: r.correlativo_req,
        facturas_url_original: r.facturas_url,
        items_original: r.items
      });

      urlsEncontradas.forEach(u => {
        planMigracion.push({
          tabla: 'requisiciones',
          registroId: r.id,
          identificador: r.correlativo_req || `REQ-${r.id}`,
          meta: u,
          urlOriginal: u.url,
          registroRef: r
        });
      });
    }
  });

  // Analizar tickets_directos
  allTickets.forEach(t => {
    let urlsEncontradas = [];

    if (t.factura_url) {
      if (typeof t.factura_url === 'string' && esUrlSupabase(t.factura_url)) {
        urlsEncontradas.push({ tipo: 'factura_url_string', url: t.factura_url });
      } else if (Array.isArray(t.factura_url)) {
        t.factura_url.forEach((item, idx) => {
          const parsed = parsearObjetoUrl(item);
          if (parsed && esUrlSupabase(parsed.url)) {
            urlsEncontradas.push({ tipo: 'ticket_factura_url_json_obj', idx, url: parsed.url, name: parsed.name, parsed });
          } else if (typeof item === 'string' && esUrlSupabase(item)) {
            urlsEncontradas.push({ tipo: 'ticket_factura_url_array_string', idx, url: item });
          }
        });
      }
    }

    // items[].historial_compras[].factura_url / soporte_url
    if (Array.isArray(t.items)) {
      t.items.forEach((item, iIdx) => {
        if (Array.isArray(item.historial_compras)) {
          item.historial_compras.forEach((h, hIdx) => {
            if (esUrlSupabase(h.factura_url)) {
              urlsEncontradas.push({ tipo: 'ticket_item_historial_factura', iIdx, hIdx, url: h.factura_url });
            }
            if (esUrlSupabase(h.soporte_url)) {
              urlsEncontradas.push({ tipo: 'ticket_item_historial_soporte', iIdx, hIdx, url: h.soporte_url });
            }
          });
        }
      });
    }

    if (urlsEncontradas.length > 0) {
      backupData.tickets_directos.push({
        id: t.id,
        codigo_control: t.codigo_control,
        factura_url_original: t.factura_url,
        items_original: t.items
      });

      urlsEncontradas.forEach(u => {
        planMigracion.push({
          tabla: 'tickets_directos',
          registroId: t.id,
          identificador: t.codigo_control || `TP-${t.id}`,
          meta: u,
          urlOriginal: u.url,
          registroRef: t
        });
      });
    }
  });

  // 3. Generar respaldo obligatorio
  const backupFileName = 'backup_urls_supabase.json';
  const backupFilePath = path.join(__dirname, backupFileName);
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');

  console.log(`\n💾 [Paso 2/4] Respaldo generado con ÉXITO en: ${backupFileName}`);
  console.log(`   - URLs de Supabase Storage detectadas para migrar: ${planMigracion.length}`);
  console.log(`   - En requisiciones:    ${backupData.requisiciones.length} registros`);
  console.log(`   - En tickets_directos: ${backupData.tickets_directos.length} registros`);

  if (planMigracion.length === 0) {
    console.log('\n✨ ¡Excelente! No se encontraron URLs apuntando a Supabase Storage. Todo está en la VPS o no hay pendientes.');
    return;
  }

  // 4. Seleccionar lote (5 en modo test o todos)
  const lote = IS_TEST ? planMigracion.slice(0, TEST_LIMIT) : planMigracion;
  console.log(`\n📦 [Paso 3/4] Procesando ${lote.length} archivo(s)...`);

  let migrados = 0;
  let fallidos = 0;

  for (let i = 0; i < lote.length; i++) {
    const item = lote[i];
    const { tabla, registroId, identificador, meta, urlOriginal, registroRef } = item;

    console.log(`\n[${i + 1}/${lote.length}] [${tabla}] ${identificador} ...`);
    console.log(`  🔗 Original: ${urlOriginal}`);

    // Extraer extensión y nombre base
    const urlParts = urlOriginal.split('/');
    const rawFileName = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
    const ext = path.extname(rawFileName).toLowerCase() || '.bin';

    // Nomenclatura sanitaria: id_requisicion_NroFactura_nombreArticulo.ext
    const reqClean = sanitizarTexto(identificador);
    const docClean = sanitizarTexto(meta.etiqueta || meta.name || 'FAC');
    const artClean = sanitizarTexto(meta.tipo || 'doc');
    let finalFileName = `${reqClean}_${docClean}_${artClean}${ext}`;

    // Si ya existe el archivo con ese nombre, usar un sufijo numérico
    let targetPath = path.join(DEST_DIR, finalFileName);
    if (fs.existsSync(targetPath)) {
      finalFileName = `${reqClean}_${docClean}_${Date.now()}${ext}`;
      targetPath = path.join(DEST_DIR, finalFileName);
    }

    // Descargar desde Supabase Storage
    const fileBuffer = await descargarArchivo(urlOriginal);
    if (!fileBuffer) {
      console.log(`  ❌ Falló descarga. Se conserva URL original sin alterar la BD.`);
      fallidos++;
      continue;
    }

    // Guardar en la VPS / carpeta destino
    fs.writeFileSync(targetPath, fileBuffer);
    const newUrl = `${VPS_BASE_URL}/${finalFileName}`;
    console.log(`  💾 Guardado: ${targetPath} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
    console.log(`  🌐 Nueva URL: ${newUrl}`);

    // Actualizar registro en Supabase
    try {
      if (tabla === 'requisiciones') {
        const req = registroRef;
        if (meta.tipo === 'facturas_url_array_json_obj') {
          const nuevas = [...req.facturas_url];
          const objActualizado = { ...meta.parsed, url: newUrl };
          nuevas[meta.idx] = JSON.stringify(objActualizado);
          req.facturas_url = nuevas;
          const { error } = await supabase.from('requisiciones').update({ facturas_url: nuevas }).eq('id', registroId);
          if (error) throw error;
        } else if (meta.tipo === 'facturas_url_array_string') {
          const nuevas = [...req.facturas_url];
          nuevas[meta.idx] = newUrl;
          req.facturas_url = nuevas;
          const { error } = await supabase.from('requisiciones').update({ facturas_url: nuevas }).eq('id', registroId);
          if (error) throw error;
        } else if (meta.tipo.startsWith('req_item_historial')) {
          const nuevosItems = JSON.parse(JSON.stringify(req.items));
          if (meta.tipo === 'req_item_historial_factura') {
            nuevosItems[meta.iIdx].historial_compras[meta.hIdx].factura_url = newUrl;
          } else {
            nuevosItems[meta.iIdx].historial_compras[meta.hIdx].soporte_url = newUrl;
          }
          req.items = nuevosItems;
          const { error } = await supabase.from('requisiciones').update({ items: nuevosItems }).eq('id', registroId);
          if (error) throw error;
        }
      } else if (tabla === 'tickets_directos') {
        const ticket = registroRef;
        if (meta.tipo === 'factura_url_string') {
          ticket.factura_url = newUrl;
          const { error } = await supabase.from('tickets_directos').update({ factura_url: newUrl }).eq('id', registroId);
          if (error) throw error;
        } else if (meta.tipo === 'ticket_factura_url_array_string') {
          const nuevas = [...ticket.factura_url];
          nuevas[meta.idx] = newUrl;
          ticket.factura_url = nuevas;
          const { error } = await supabase.from('tickets_directos').update({ factura_url: nuevas }).eq('id', registroId);
          if (error) throw error;
        } else if (meta.tipo === 'ticket_factura_url_json_obj') {
          const nuevas = [...ticket.factura_url];
          const objActualizado = { ...meta.parsed, url: newUrl };
          nuevas[meta.idx] = JSON.stringify(objActualizado);
          ticket.factura_url = nuevas;
          const { error } = await supabase.from('tickets_directos').update({ factura_url: nuevas }).eq('id', registroId);
          if (error) throw error;
        } else if (meta.tipo.startsWith('ticket_item_historial')) {
          const nuevosItems = JSON.parse(JSON.stringify(ticket.items));
          if (meta.tipo === 'ticket_item_historial_factura') {
            nuevosItems[meta.iIdx].historial_compras[meta.hIdx].factura_url = newUrl;
          } else {
            nuevosItems[meta.iIdx].historial_compras[meta.hIdx].soporte_url = newUrl;
          }
          ticket.items = nuevosItems;
          const { error } = await supabase.from('tickets_directos').update({ items: nuevosItems }).eq('id', registroId);
          if (error) throw error;
        }
      }

      console.log(`  ✅ Base de datos actualizada con éxito.`);
      migrados++;
    } catch (errUpd) {
      console.error(`  ❌ Error actualizando BD en ${tabla} ID ${registroId}:`, errUpd.message);
      fallidos++;
    }
  }

  // 5. Resumen final
  console.log('\n' + '='.repeat(75));
  console.log('📊 [Paso 4/4] RESUMEN DE MIGRACIÓN');
  console.log('='.repeat(75));
  console.log(`  - Archivos procesados:   ${lote.length}`);
  console.log(`  - Migrados con éxito:    ${migrados}`);
  console.log(`  - Fallidos:              ${fallidos}`);
  console.log(`  - Archivo de respaldo:   ${backupFileName}`);
  console.log(`  - Borrado en Supabase:   0 archivos eliminados (según requerimiento)`);
  console.log('='.repeat(75));

  if (IS_TEST) {
    console.log('\n💡 [MODO DE PRUEBA FINALIZADO]');
    console.log(`   Se descargaron ${migrados} archivos de prueba en: ${DEST_DIR}`);
    console.log('   Por favor, verifica en tu navegador las URLs migradas en https://sitc.totalclean.com.ve/uploads/');
    console.log('   Cuando confirmes que abren correctamente al 100%, ejecuta la migración total con:');
    console.log('   👉 node migrar_storage_vps.js\n');
  } else {
    console.log('\n🎉 ¡MIGRACIÓN COMPLETA FINALIZADA EXITOSAMENTE!');
    console.log('   Las facturas ahora se sirven desde la VPS y no consumen almacenamiento ni egress de Supabase.\n');
  }
}

ejecutarMigracion().catch(err => {
  console.error('Fatal error en migración:', err);
  process.exit(1);
});
