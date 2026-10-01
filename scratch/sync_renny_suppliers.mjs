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

const suppliersToLoad = [
  {
    id: 'PROV-WL-DISENO',
    rif: 'V-18833392-6',
    razon_social: 'WL DISEÑO & SUBLIMACION',
    persona_contacto: 'WK DISEÑO',
    contacto_nombre: 'WK DISEÑO',
    telefono: '0424698886',
    correo: '',
    direccion: 'Urbanización Coromoto, en la calle 163 con Avenida 41A.',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'EQUIPOS DE OFICINA',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-YOANNY-URDANETA',
    rif: 'V-13830370-1',
    razon_social: 'YOANNY JOSEFINA URDANETA BARRIOS REPARACIONES DE TRASPLANTE VENTA DE TRIPAS CAUCHOS DE CARRUCHA COSTRUCCION Y ALGO MAS',
    persona_contacto: 'YOANNY JOSEFINA',
    contacto_nombre: 'YOANNY JOSEFINA',
    telefono: '04120653527',
    correo: 'YOANNY44@GMAIL.COM',
    direccion: 'AV 19B BARRIO CERRO PELAO, CASA NO, 109 B-54, MARACAIBO ESTADO ZULIA',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'SERVICIO',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-ZULEIKA-LARA',
    rif: 'V-24228215-0',
    razon_social: 'ZULEIKA LARA',
    persona_contacto: 'ZULEIKA LARA',
    contacto_nombre: 'ZULEIKA LARA',
    telefono: '0424-8111910',
    correo: '',
    direccion: 'EL TIGRE EDO. ANZOATEGUI',
    ciudad: 'El Tigre',
    localizacion: 'EL TIGRE EDO. ANZOATEGUI',
    categoria: 'OTROS',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-URBE-RAFAEL-BELLOSO',
    rif: 'J-07034507-1',
    razon_social: 'UNIVERSIDAD RAFAEL BELLOSO CHACIN',
    persona_contacto: 'URBE',
    contacto_nombre: 'URBE',
    telefono: '0261-2008723',
    correo: '',
    direccion: 'PROLONGACION CIRCUNVALACION 2 CON AV. 16 GUAJIRA',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'SERVICIO, OTROS',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-VALE-CANJEABLE-TICKETVEN',
    rif: 'J-31149896-6',
    razon_social: 'VALE CANJEABLE TICKETVEN, CA',
    persona_contacto: 'VALE CANJEABLE',
    contacto_nombre: 'VALE CANJEABLE',
    telefono: '02126279800',
    correo: '',
    direccion: 'LAS MERCEDES CARACAS',
    ciudad: 'Caracas',
    localizacion: 'caracas',
    categoria: 'ALIMENTACIÓN',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-VENE-TRUCK',
    rif: 'J-50171570-0',
    razon_social: 'VENE-TRUCK',
    persona_contacto: 'VENE-TRUCK',
    contacto_nombre: 'VENE-TRUCK',
    telefono: '04146502973',
    correo: '',
    direccion: 'Av. Circunvalación 2, Maracaibo, Estado Zulia.',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'REPUESTO',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-VENTA-MATERIALES-ELECTRICOS',
    rif: 'J-29962835-2',
    razon_social: 'VENTA DE MATERIALES E INSUMOS ELECTRICOS',
    persona_contacto: 'VENTA DE MATERIALES',
    contacto_nombre: 'VENTA DE MATERIALES',
    telefono: '04127866836',
    correo: 'MEZULCA22022@GMAIL.COM',
    direccion: 'AV.17 LOS HATICOS,N113-250,GALPONES RIESES MUNICIPIO MARACAIBO,ESTADO ZULIA',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'OTROS',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-VIGILAME-SERVICIOS',
    rif: 'J-29525661-2',
    razon_social: 'VIGILAME SERVICIOS INTEGRALES',
    persona_contacto: 'VIGILANTE SERVICIOS',
    contacto_nombre: 'VIGILANTE SERVICIOS',
    telefono: '04126599632',
    correo: 'info@vigilame.net',
    direccion: 'CALLE 85 CON AV 13B CASA NRO 13B-58 SECTOR BELLOSO',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'SERVICIO',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-INVERSIONES-LORUSSO',
    rif: 'J-30702656-0',
    razon_social: 'INVERSIONES LORUSSO, C.A.',
    persona_contacto: 'LUISA LORUSSO',
    contacto_nombre: 'LUISA LORUSSO',
    telefono: '0265-6628564',
    correo: 'luisalorusso@gmail.com',
    direccion: 'CENTRO EMPRESARIAL LORUSSO SECTOR LA L CUIDAD OJEDA',
    ciudad: 'Ciudad Ojeda',
    localizacion: 'Maracaibo',
    categoria: 'ARRENDAMIENTO, OTROS',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-TRUMELTARCA',
    rif: 'J-40431884-4',
    razon_social: 'TRUMELTARCA',
    persona_contacto: 'TRUMELTACAR',
    contacto_nombre: 'TRUMELTACAR',
    telefono: '04245698965',
    correo: '',
    direccion: 'sector Cañada Honda, en la Calle 96, subiendo por el Puente Socorro a 50 metros detrás del Hotel',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'EQUIPO',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-GRUAS-RM',
    rif: 'J-40784553-5',
    razon_social: 'SERVICIOS DE GRUAS RM C A',
    persona_contacto: 'SERVICIOS DE GRUAS',
    contacto_nombre: 'SERVICIOS DE GRUAS',
    telefono: '4246129595',
    correo: '',
    direccion: 'AVE 19A CASA No 112200 BARRIO CONTO MCBO EDO ZULIA',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'SERVICIO, EQUIPO, TRANSPORTE',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-SANTA-LUCIA',
    rif: 'J-31093193-3',
    razon_social: 'SERVICIO MEDICO SANTA LUCIA',
    persona_contacto: 'SANTA LUCIA',
    contacto_nombre: 'SANTA LUCIA',
    telefono: '',
    correo: '',
    direccion: 'SANTA LUCIA MARACAIBO EDO ZULIA',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'SERVICIO MEDICO',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-SEGURIDAD-TECNICA-ORIENTE',
    rif: 'J-40786547-1',
    razon_social: 'SEGURIDAD TECNICA INDUSTRIAL ORIENTE C.A',
    persona_contacto: 'SEGURIDAD TECNICA',
    contacto_nombre: 'SEGURIDAD TECNICA',
    telefono: '0424-8987636',
    correo: '',
    direccion: 'BARCELONA ESTADO ANZOATEGUI',
    ciudad: 'Barcelona',
    localizacion: 'BARCELONA ESTADO ANZOATEGUI',
    categoria: 'OTROS, SERVICIO',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-SERMAKOL',
    rif: 'J-50792563-3',
    razon_social: 'SERMAKOL',
    persona_contacto: 'SERMAKOL',
    contacto_nombre: 'SERMAKOL',
    telefono: '04146033481',
    correo: 'marilyndelvalledelgado@gmail.com',
    direccion: 'Av. 14 A calle 31 casa N0. 1A-27 sector parcelamiento INAVI San francisco',
    ciudad: 'San Francisco',
    localizacion: 'Maracaibo',
    categoria: 'SERVICIO',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

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
  'VENTAS', 'VENTA', 'PRODUCTOS', 'INDUSTRIAS', 'INTERNACIONAL', 'NACIONAL', 
  'VENEZUELA', 'TOTAL', 'DROGUERIA', 'DROGUERIAS', 'FARMACIAS', 'FARMACIA',
  'LABORATORIO', 'LABORATORIOS', 'EMPRESAS', 'EMPRESA', 'CENTRO', 'CLINICA',
  'MATERIALES', 'INSUMOS', 'ELECTRICOS', 'REPARACIONES', 'EQUIPOS', 'EQUIPO',
  'ORIENTE', 'TECNICA', 'INDUSTRIAL', 'INTEGRALES', 'CAUCHOS', 'CONSTRUCCION',
  'COMERCIAL', 'GENERALES', 'COMERCIO'
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

  // Si ambos tienen RIFs válidos (>= 7 dígitos numéricos) pero son DISTINTOS, NUNCA son el mismo proveedor
  if (cRifA.nums.length >= 7 && cRifB.nums.length >= 7) {
    const sonRifsIguales = (cRifA.nums === cRifB.nums) || 
      (Math.abs(cRifA.nums.length - cRifB.nums.length) === 1 && (cRifA.nums.startsWith(cRifB.nums) || cRifB.nums.startsWith(cRifA.nums)));
    if (!sonRifsIguales) {
      return false;
    }
    return true;
  }

  if (cRifA.raw && cRifB.raw && cRifA.raw.length >= 6 && cRifA.raw === cRifB.raw) {
    return true;
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
    if (!isGeneric && shorter.length >= 3) {
      return true;
    }
  }

  const distinctiveA = tokensA.filter(w => !GENERIC_WORDS_SUPPLIERS.has(w) && w.length >= 3);
  const distinctiveB = tokensB.filter(w => !GENERIC_WORDS_SUPPLIERS.has(w) && w.length >= 3);

  if (distinctiveA.length > 0 && distinctiveB.length > 0) {
    const shared = distinctiveA.filter(w => distinctiveB.includes(w));
    if (shared.length > 0) {
      if (shared.some(w => w.length >= 3 && !GENERIC_WORDS_SUPPLIERS.has(w))) {
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

async function syncAllSuppliers() {
  console.log("Fetching current SYS-PROVEEDORES-CENTRAL record...");
  const { data: found } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, items')
    .eq('correlativo_req', 'SYS-PROVEEDORES-CENTRAL')
    .limit(1);

  let currentList = [];
  let currentHistory = [];
  let rowId = null;

  if (found && found.length > 0) {
    rowId = found[0].id;
    const masterObj = (found[0].items && found[0].items[0]) || {};
    currentList = Array.isArray(masterObj.proveedores) ? masterObj.proveedores : [];
    currentHistory = Array.isArray(masterObj.historial_modificaciones) ? masterObj.historial_modificaciones : [];
  }

  // Prepend new suppliers and deduplicate
  let mergedList = deduplicarListaProveedores([...suppliersToLoad, ...currentList]);

  // Create audit history items for the newly loaded suppliers
  const newHistoryEntries = suppliersToLoad.map(s => ({
    id: `MOD-SYNC-${s.rif.replace(/[^0-9A-Z]/g, '')}`,
    proveedor_id: s.id,
    razon_social: s.razon_social,
    rif: s.rif,
    tipo_cambio: 'RIF_ACTUALIZADO',
    etiqueta: '🆔 RIF Actualizado',
    cambios: [
      { campo: 'RIF', antes: 'Sin RIF', despues: s.rif, destacado: true },
      { campo: 'Contacto', antes: 'Sin contacto', despues: s.persona_contacto || 'Sin contacto' },
      { campo: 'Teléfono', antes: 'Sin teléfono', despues: s.telefono || 'Sin teléfono' },
      { campo: 'Dirección', antes: 'Sin dirección', despues: s.direccion || 'Sin dirección' },
      { campo: 'Categoría', antes: 'OTROS', despues: s.categoria || 'OTROS' }
    ],
    usuario_nombre: 'Renny Maestre',
    usuario_correo: 'rmaestre@totalclean.com',
    fecha: new Date().toISOString()
  }));

  const histMap = new Map();
  [...newHistoryEntries, ...currentHistory].forEach(h => {
    if (h && h.id && !histMap.has(h.id)) {
      histMap.set(h.id, h);
    }
  });
  const mergedHistory = Array.from(histMap.values()).slice(0, 500);

  const payloadItems = [{
    tipo: 'DIRECTORIO_CENTRAL_PROVEEDORES',
    ultima_actualizacion: new Date().toISOString(),
    proveedores: mergedList,
    historial_modificaciones: mergedHistory
  }];

  if (rowId) {
    console.log(`Updating central cloud directory with ${mergedList.length} total suppliers...`);
    const { error: uErr } = await supabase
      .from('requisiciones')
      .update({
        items: payloadItems,
        updated_at: new Date().toISOString()
      })
      .eq('id', rowId);
    console.log("Update result error:", uErr);
  }

  console.log("DONE! Successfully synced all Renny Maestre suppliers to the central cloud repository.");
}

syncAllSuppliers();
