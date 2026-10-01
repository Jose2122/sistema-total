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
  'SERVICIOS', 'IMPORTADORA', 'CORPORACION', 'GRUPO', 'REPUESTOS', 
  'CONSTRUCCIONES', 'FERRETERIA', 'MANTENIMIENTO', 'TECNOLOGIA', 
  'SOLUCIONES', 'CONSULTORES', 'AUTOMOTRIZ', 'TRANSPORTE', 'LOGISTICA', 
  'VENTAS', 'PRODUCTOS', 'INDUSTRIAS', 'INTERNACIONAL', 'NACIONAL', 
  'VENEZUELA', 'TOTAL', 'DROGUERIA', 'DROGUERIAS', 'FARMACIAS', 'FARMACIA',
  'LABORATORIO', 'LABORATORIOS', 'EMPRESAS', 'EMPRESA', 'CENTRO', 'CLINICA'
]);

const sonProveedoresCoincidentes = (provObjOrNameA, provObjOrNameB) => {
  if (!provObjOrNameA || !provObjOrNameB) return false;

  const idA = typeof provObjOrNameA === 'object' ? provObjOrNameA?.id : null;
  const idB = typeof provObjOrNameB === 'object' ? provObjOrNameB?.id : null;

  if (idA && idB && !isNaN(Number(idA)) && !isNaN(Number(idB)) && Number(idA) > 0 && Number(idA) === Number(idB)) {
    return true;
  }
  if (idA && idB && String(idA) === String(idB) && !String(idA).startsWith('PROV-') && !String(idA).startsWith('HIST-')) {
    return true;
  }

  const rifA = typeof provObjOrNameA === 'object' ? (provObjOrNameA?.rif || provObjOrNameA?.proveedor_rif || '') : '';
  const rifB = typeof provObjOrNameB === 'object' ? (provObjOrNameB?.rif || provObjOrNameB?.proveedor_rif || '') : '';
  
  const cRifA = extraerCoreRif(rifA);
  const cRifB = extraerCoreRif(rifB);

  if (cRifA.raw && cRifB.raw && cRifA.raw.length >= 6 && cRifA.raw === cRifB.raw) {
    return true;
  }
  if (cRifA.nums.length >= 7 && cRifB.nums.length >= 7) {
    if (cRifA.nums === cRifB.nums) return true;
    if (Math.abs(cRifA.nums.length - cRifB.nums.length) === 1 && (cRifA.nums.startsWith(cRifB.nums) || cRifB.nums.startsWith(cRifA.nums))) {
      return true;
    }
  }

  const nameA = typeof provObjOrNameA === 'object' ? (provObjOrNameA?.razon_social || provObjOrNameA?.proveedor_nombre || provObjOrNameA?.nombre || '') : String(provObjOrNameA);
  const nameB = typeof provObjOrNameB === 'object' ? (provObjOrNameB?.razon_social || provObjOrNameB?.proveedor_nombre || provObjOrNameB?.nombre || '') : String(provObjOrNameB);

  const cleanA = normalizarNombreEmpresa(nameA);
  const cleanB = normalizarNombreEmpresa(nameB);

  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB) return true;

  const tokensA = cleanA.split(' ').filter(w => w.length >= 2);
  const tokensB = cleanB.split(' ').filter(w => w.length >= 2);

  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
    const shorter = cleanA.length < cleanB.length ? cleanA : cleanB;
    const isGeneric = GENERIC_WORDS_SUPPLIERS.has(shorter.trim());
    if (!isGeneric && shorter.length >= 2) {
      return true;
    }
  }

  const distinctiveA = tokensA.filter(w => !GENERIC_WORDS_SUPPLIERS.has(w) && w.length >= 2);
  const distinctiveB = tokensB.filter(w => !GENERIC_WORDS_SUPPLIERS.has(w) && w.length >= 2);

  if (distinctiveA.length > 0 && distinctiveB.length > 0) {
    const shared = distinctiveA.filter(w => distinctiveB.includes(w));
    if (shared.length > 0) {
      if (shared.some(w => w.length >= 2 && !GENERIC_WORDS_SUPPLIERS.has(w))) {
        return true;
      }
    }
  }

  return false;
};

const fusionarProveedor = (base = {}, nuevo = {}) => {
  if (!base && !nuevo) return {};
  if (!base) return { ...nuevo };
  if (!nuevo) return { ...base };

  const merged = { ...base, ...nuevo };
  const camposTexto = [
    'rif', 'telefono', 'correo', 'persona_contacto', 'contacto_nombre', 
    'contacto_administrativo', 'direccion', 'ciudad', 'localizacion', 
    'categoria', 'observaciones_negociacion', 'nivel_preferencial', 'condiciones_acuerdo_nota'
  ];
  
  camposTexto.forEach(campo => {
    const valBase = (base[campo] || '').toString().trim();
    const valNuevo = (nuevo[campo] || '').toString().trim();
    if (valNuevo) {
      merged[campo] = nuevo[campo];
    } else if (valBase) {
      merged[campo] = base[campo];
    }
  });

  const rifBase = (base.rif || '').trim().toUpperCase();
  const rifNuevo = (nuevo.rif || '').trim().toUpperCase();
  if (rifNuevo && rifNuevo !== 'SIN RIF') {
    merged.rif = rifNuevo;
  } else if (rifBase && rifBase !== 'SIN RIF') {
    merged.rif = rifBase;
  }

  const nameBase = (base.razon_social || base.nombre || '').trim();
  const nameNuevo = (nuevo.razon_social || nuevo.nombre || '').trim();
  if (nameNuevo) {
    merged.razon_social = nameNuevo;
  } else if (nameBase) {
    merged.razon_social = nameBase;
  }

  const userBase = base.actualizado_por_nombre || base.creado_por_nombre || '';
  const userNuevo = nuevo.actualizado_por_nombre || nuevo.creado_por_nombre || '';
  if (userNuevo && userNuevo.toLowerCase() !== 'sistema') {
    merged.actualizado_por_nombre = userNuevo;
    merged.actualizado_por = nuevo.actualizado_por || nuevo.creado_por;
  } else if (userBase && userBase.toLowerCase() !== 'sistema') {
    merged.actualizado_por_nombre = userBase;
    merged.actualizado_por = base.actualizado_por || base.creado_por;
  }

  return merged;
};

const deduplicarListaProveedores = (lista = []) => {
  if (!Array.isArray(lista) || lista.length === 0) return [];
  const unicos = [];
  for (const prov of lista) {
    if (!prov) continue;
    const idx = unicos.findIndex(existente => sonProveedoresCoincidentes(existente, prov));
    if (idx >= 0) {
      unicos[idx] = fusionarProveedor(unicos[idx], prov);
    } else {
      unicos.push({ ...prov });
    }
  }
  const final = [];
  for (const p of unicos) {
    const idx = final.findIndex(existente => sonProveedoresCoincidentes(existente, p));
    if (idx >= 0) {
      final[idx] = fusionarProveedor(final[idx], p);
    } else {
      final.push(p);
    }
  }
  return final;
};

async function seedCloudDirectory() {
  console.log("Reading suppliers from scratch/proveedores_extraidos_actualizados.json...");
  let scratchSuppliers = [];
  try {
    const raw = fs.readFileSync('scratch/proveedores_extraidos_actualizados.json', 'utf-8');
    scratchSuppliers = JSON.parse(raw);
  } catch (e) {
    console.warn("Could not read scratch json:", e.message);
  }

  const verifiedSuppliers = [
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
      status: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
      status: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
      status: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
      status: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const combined = deduplicarListaProveedores([...verifiedSuppliers, ...scratchSuppliers]);
  console.log(`Total proveedores listos para sincronizar en la nube: ${combined.length}`);

  const initialHistory = [
    {
      id: `MOD-SEED-1`,
      proveedor_id: 'PROV-FERRETERIA-ROCCA',
      razon_social: 'FERRETERIA ROCCA',
      rif: 'J-07040810-3',
      tipo_cambio: 'REGISTRO_NUEVO',
      etiqueta: '✨ Proveedor Creado',
      cambios: [
        { campo: 'Razón Social', antes: '—', despues: 'FERRETERIA ROCCA' },
        { campo: 'RIF', antes: '—', despues: 'J-07040810-3', destacado: true },
        { campo: 'Contacto', antes: '—', despues: 'ferreteria rocca' },
        { campo: 'Teléfono', antes: '—', despues: '0414-569-5485' },
        { campo: 'Dirección', antes: '—', despues: 'AV 23 SECTOR 1 DE MAYO 79 -40' },
        { campo: 'Categoría', antes: '—', despues: 'FERRETERÍA' }
      ],
      usuario_nombre: 'Renny Maestre',
      usuario_correo: 'rmaestre@totalclean.com',
      fecha: new Date().toISOString()
    },
    {
      id: `MOD-SEED-2`,
      proveedor_id: 298,
      razon_social: 'FARMATODO',
      rif: 'J-00020200-1',
      tipo_cambio: 'RIF_ACTUALIZADO',
      etiqueta: '🆔 RIF Actualizado',
      cambios: [
        { campo: 'RIF', antes: 'Sin RIF', despues: 'J-00020200-1', destacado: true },
        { campo: 'Contacto', antes: 'Sin contacto', despues: 'farmatodo' },
        { campo: 'Teléfono', antes: 'Sin teléfono', despues: '0414869632' },
        { campo: 'Dirección', antes: 'Sin dirección', despues: 'AV LOS GUAYABITOS C EXPRESO BARUTA NIVEL 5 OF UNICA URB LA TRINIDAD' }
      ],
      usuario_nombre: 'Renny Maestre',
      usuario_correo: 'rmaestre@totalclean.com',
      fecha: new Date().toISOString()
    }
  ];

  const payloadItems = [{
    tipo: 'DIRECTORIO_CENTRAL_PROVEEDORES',
    ultima_actualizacion: new Date().toISOString(),
    proveedores: combined,
    historial_modificaciones: initialHistory
  }];

  const { data: existing } = await supabase
    .from('requisiciones')
    .select('id')
    .eq('correlativo_req', 'SYS-PROVEEDORES-CENTRAL')
    .limit(1);

  if (existing && existing.length > 0) {
    console.log("Updating existing SYS-PROVEEDORES-CENTRAL with id:", existing[0].id);
    const { error: uErr } = await supabase
      .from('requisiciones')
      .update({
        items: payloadItems,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing[0].id);
    console.log("Update complete. Error:", uErr);
  } else {
    console.log("Inserting new SYS-PROVEEDORES-CENTRAL...");
    const { error: iErr } = await supabase
      .from('requisiciones')
      .insert([{
        correlativo_req: 'SYS-PROVEEDORES-CENTRAL',
        solicitante: 'Sistema TotalClean',
        gerencia: 'Compras',
        centro_costo: 'Directorio',
        fecha_requerida: new Date().toISOString().split('T')[0],
        fecha_emision: new Date().toISOString(),
        prioridad: 'Baja',
        status_compra: 'Completado',
        estado_aprobacion: 'sistema_interno',
        justificacion: 'DIRECTORIO MAESTRO CENTRALIZADO DE PROVEEDORES SITC',
        items: payloadItems
      }]);
    console.log("Insert complete. Error:", iErr);
  }

  console.log("Done! Seeded central directory in Supabase successfully.");
}

seedCloudDirectory();
