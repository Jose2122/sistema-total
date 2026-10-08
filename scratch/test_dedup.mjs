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

const normalizarNombreEmpresa = (nombre) => {
  if (!nombre) return '';
  let str = nombre
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\-_/\\#()&"']/g, ' ')
    .replace(/\s+/g, ' ');

  const legalRegex = /\b(C\s*A|S\s*A|S\s*R\s*L|SRL|C\s*POR\s*A|C\s*P\s*A|SOCIEDAD\s*ANONIMA|COMPANIA\s*ANONIMA|FIRMA\s*PERSONAL|F\s*P|FP|E\s*I\s*R\s*L|EIRL|LLC|INC|INCORPORATED|CORP|CORPORATION|CORPORACION|GMBH|S\s*A\s*S|SAS|L\s*T\s*D\s*A|LTDA|S\s*C|SC|C\s*C)\b/gi;
  str = str.replace(legalRegex, ' ').replace(/\s+/g, ' ').trim();

  return str;
};

const extraerCoreRif = (rif) => {
  if (!rif) return { raw: '', nums: '', core: '' };
  const raw = rif.toString().trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  const nums = raw.replace(/[^0-9]/g, '');
  const core = nums.length >= 8 ? nums.substring(0, 8) : nums;
  return { raw, nums, core };
};

const GENERIC_WORDS_SUPPLIERS = new Set([
  'INVERSIONES', 'DISTRIBUIDORA', 'COMERCIALIZADORA', 'SUMINISTROS', 
  'SERVICIOS', 'SERVICIO', 'SERVICES', 'SERVICE', 'IMPORTADORA', 'CORPORACION', 
  'GRUPO', 'REPUESTOS', 'REPUESTO', 'CONSTRUCCIONES', 'CONSTRUCCION', 'FERRETERIA', 
  'MANTENIMIENTO', 'TECNOLOGIA', 'TECNOLOGIAS', 'TECHNOLOGY', 'TECHNOLOGIES', 'TECH',
  'SOLUCIONES', 'SOLUCION', 'SOLUTIONS', 'SOLUTION', 'CONSULTORES', 'CONSULTOR', 
  'AUTOMOTRIZ', 'TRANSPORTE', 'LOGISTICA', 'VENTAS', 'VENTA', 'PRODUCTOS', 'PRODUCTO', 
  'INDUSTRIAS', 'INDUSTRIA', 'INTERNACIONAL', 'NACIONAL', 'VENEZUELA', 'TOTAL', 
  'DROGUERIA', 'DROGUERIAS', 'FARMACIAS', 'FARMACIA', 'LABORATORIO', 'LABORATORIOS', 
  'EMPRESAS', 'EMPRESA', 'CENTRO', 'CLINICA', 'MATERIALES', 'INSUMOS', 'ELECTRICOS', 
  'ELECTRICO', 'REPARACIONES', 'EQUIPOS', 'EQUIPO', 'ORIENTE', 'OCCIDENTE', 'TECNICA', 
  'INDUSTRIAL', 'INTEGRALES', 'INTEGRAL', 'CAUCHOS', 'CAUCHO', 'COMERCIAL', 'GENERALES', 
  'GENERAL', 'COMERCIO', 'AND', 'THE', 'LOS', 'LAS', 'DEL', 'DE', 'LA', 'EL', 'Y', 
  'MEGA', 'MULTI', 'MAX', 'PLUS', 'EXPRESS', 'SUPER', 'GLOBAL', 'WORLD', 'STORE', 'SHOP'
]);

const sonProveedoresCoincidentes = (provObjOrNameA, provObjOrNameB) => {
  if (!provObjOrNameA || !provObjOrNameB) return false;

  const idA = typeof provObjOrNameA === 'object' ? provObjOrNameA?.id : null;
  const idB = typeof provObjOrNameB === 'object' ? provObjOrNameB?.id : null;

  // 1. Coincidencia por ID numérico de base de datos
  if (idA && idB && !isNaN(Number(idA)) && !isNaN(Number(idB)) && Number(idA) > 0 && Number(idA) === Number(idB)) {
    return true;
  }
  // Coincidencia por ID exacto de string (si no son temporales genéricos)
  if (idA && idB && String(idA) === String(idB) && !String(idA).startsWith('PROV-') && !String(idA).startsWith('HIST-')) {
    return true;
  }

  // 2. Coincidencia por RIF
  const rifA = typeof provObjOrNameA === 'object' ? (provObjOrNameA?.rif || provObjOrNameA?.proveedor_rif || '') : '';
  const rifB = typeof provObjOrNameB === 'object' ? (provObjOrNameB?.rif || provObjOrNameB?.proveedor_rif || '') : '';
  
  const cRifA = extraerCoreRif(rifA);
  const cRifB = extraerCoreRif(rifB);

  // Si ambos tienen RIFs válidos (>= 7 dígitos numéricos)
  if (cRifA.nums.length >= 7 && cRifB.nums.length >= 7) {
    const sonRifsIguales = (cRifA.nums === cRifB.nums) || 
      (Math.abs(cRifA.nums.length - cRifB.nums.length) === 1 && (cRifA.nums.startsWith(cRifB.nums) || cRifB.nums.startsWith(cRifA.nums)));
    return sonRifsIguales;
  }

  if (cRifA.raw && cRifB.raw && cRifA.raw.length >= 7 && cRifA.raw === cRifB.raw) {
    return true;
  }

  // 3. Coincidencia por Nombre / Razón Social Normalizada
  const nameA = typeof provObjOrNameA === 'object' ? (provObjOrNameA?.razon_social || provObjOrNameA?.proveedor_nombre || provObjOrNameA?.nombre || '') : String(provObjOrNameA);
  const nameB = typeof provObjOrNameB === 'object' ? (provObjOrNameB?.razon_social || provObjOrNameB?.proveedor_nombre || provObjOrNameB?.nombre || '') : String(provObjOrNameB);

  const cleanA = normalizarNombreEmpresa(nameA);
  const cleanB = normalizarNombreEmpresa(nameB);

  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB) return true;

  const tokensA = cleanA.split(' ').filter(w => w.length >= 2);
  const tokensB = cleanB.split(' ').filter(w => w.length >= 2);

  const distinctiveA = tokensA.filter(w => !GENERIC_WORDS_SUPPLIERS.has(w));
  const distinctiveB = tokensB.filter(w => !GENERIC_WORDS_SUPPLIERS.has(w));

  // Si ambos tienen palabras distintivas y son exactamente idénticas
  if (distinctiveA.length > 0 && distinctiveB.length > 0) {
    const strDistA = distinctiveA.join(' ');
    const strDistB = distinctiveB.join(' ');
    if (strDistA === strDistB) return true;

    // Si una lista distintiva contiene a la otra Y tiene alta coincidencia
    const shared = distinctiveA.filter(w => distinctiveB.includes(w));
    if (shared.length === distinctiveA.length && shared.length === distinctiveB.length) {
      return true;
    }
  }

  return false;
};

async function test() {
  const target = {
    id: "PROV-1791470955778",
    rif: "J-40282085-2",
    razon_social: "TECHNOLOGY AND SERVICE"
  };

  const { data: syncReq } = await supabase.from('requisiciones').select('*').eq('correlativo_req', 'SYS-PROVEEDORES-CENTRAL');
  const cloudProvs = syncReq[0].items[0].proveedores || [];
  
  const matches = cloudProvs.filter(p => sonProveedoresCoincidentes(p, target));
  console.log("Matches con nueva logica:", matches.map(m => ({ id: m.id, razon_social: m.razon_social, rif: m.rif })));
}
test();
