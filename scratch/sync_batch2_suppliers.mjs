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

const batch2Suppliers = [
  {
    id: 'PROV-REGINA-GAS',
    rif: 'J-07010322-1',
    razon_social: 'REGINA GAS C.A',
    persona_contacto: 'REGINA GAS',
    contacto_nombre: 'REGINA GAS',
    telefono: '04140661801',
    correo: 'REGINAGAS12@GMAIL.COM',
    direccion: 'AV 19C LOCAL N97A SECTOR CAÑADA HONDA MARACAIBO EDO ZULIA VENEZUELA',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'MANTENIMIENTO',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-RENSER-ORIENTE',
    rif: 'J-31259448-9',
    razon_social: 'RENSER ORIENTE,C.A',
    persona_contacto: 'RENSER ORIENTE',
    contacto_nombre: 'RENSER ORIENTE',
    telefono: '0412636398',
    correo: '',
    direccion: 'AV. JOSE ANTONIO ANZOATEGUI, CONJUNTO RESIDENCIAL DON JUAN, GALPON Nº 9 BARCELONA EDO, ANZ.',
    ciudad: 'Lecheria',
    localizacion: 'LECHERIA ESTADO ANZOATEGUI',
    categoria: 'EQUIPOS DE SEGURIDAD, MANTENIMIENTO, SERVICIO, REPUESTO',
    creado_por_nombre: 'Analista Compras',
    actualizado_por_nombre: 'Analista Compras',
    creado_por: 'compras@totalclean.com',
    actualizado_por: 'compras@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-REP-FERRELECTRICA',
    rif: 'J-30922116-7',
    razon_social: 'REPRESENTACIONES FERRELECTRICA, C.A.',
    persona_contacto: 'REPRESENTACIONES',
    contacto_nombre: 'REPRESENTACIONES',
    telefono: '04246595576',
    correo: 'marilyndelvalledelgado@gmail.com',
    direccion: 'cIRCUNVALACION n0. 2 CON AV. 59 LOCAL 10206 MARACAIBO ESTADO ZULIA',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'FERRETERÍA',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-OXIGENOS-ELY-ACOSTA',
    rif: 'J-50591702-1',
    razon_social: 'OXIGENOS ELY ACOSTA 2024,C.A.',
    persona_contacto: 'OXIGENOS ELY ACOSTA',
    contacto_nombre: 'OXIGENOS ELY ACOSTA',
    telefono: '04146442212',
    correo: 'oxigenoselyacosta2024@gmail.com',
    direccion: 'DOMICILIO FISCAL AV. 17 CALLE 120 EDIF MAT-VEN. PISO PLANTA BAJA LOCAL L1 SECTOR HATICOS MARACAIBO EDO. ZULIA ZONA POSTAL 4001',
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
    id: 'PROV-PP-DISTRIBUIDORA',
    rif: 'J-40891604-5',
    razon_social: 'P & P DISTRIBUIDORA C.A.',
    persona_contacto: 'P & P DISTRIBUIDORA',
    contacto_nombre: 'P & P DISTRIBUIDORA',
    telefono: '0416-5680174',
    correo: '',
    direccion: 'CALLE 94C-1 ENTRE AV 73 Y 74 CASA NUMERO 73-18 BARRIO LOS CHAGUARAMOS, MARACAIBO',
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
    id: 'PROV-PAPELERIA-ESTEVA',
    rif: 'J-30539267-6',
    razon_social: 'PAPELERIA ESTEVA EL TRANSITO C A',
    persona_contacto: 'PAPELERIA ESTEVA',
    contacto_nombre: 'PAPELERIA ESTEVA',
    telefono: '04146682641',
    correo: 'VENTASSTEVA@GMAIL.COM',
    direccion: 'AV 16 No 95D07 SECTOR EL TRANSITO',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'CONSUMIBLE, PAPELERÍA',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-MULTIREPUESTOS-EBENEZER',
    rif: 'J-50381364-4',
    razon_social: 'MULTIREPUESTOS EBENEZER M & F .C.A',
    persona_contacto: 'MULTISERVICIOS EBENEZER M & F',
    contacto_nombre: 'MULTISERVICIOS EBENEZER M & F',
    telefono: '0414-6775217',
    correo: 'MULTIREPUESTOSEBENEZERMF@GMAIL.COM',
    direccion: 'CALLE178E LOCAL N 48E CASERIO LIMPIA SUR EL SILENCIO EDP, ZULIA',
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
    id: 'PROV-MULTISERVICIOS-DANY-MANUEL',
    rif: 'J-40690539-9',
    razon_social: 'MULTISERVICIOS DANY & MANUEL C.A.',
    persona_contacto: 'MULTISERVICIOS DANY & MANUEL',
    contacto_nombre: 'MULTISERVICIOS DANY & MANUEL',
    telefono: '04246653991',
    correo: 'MULTISERVICIOSDANYMANUELCA@GMAIL.COM',
    direccion: 'CALLE178E, LOCAL GALPON N 48E-67 CASERIO LIMPIA SUR EL SILENCIO ESTADO ZULIA',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'MANTENIMIENTO',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-MULTISERVICIOS-DIVICA',
    rif: 'J-31713732-9',
    razon_social: 'MULTISERVICIOS DIVICA',
    persona_contacto: 'MULTISERVICIOS DIVICA',
    contacto_nombre: 'MULTISERVICIOS DIVICA',
    telefono: '0414-659-5486',
    correo: 'DIVICAADM@gmail.com',
    direccion: 'AV CENTENARIO, SECTOR SAN ONOFRE GALPÓN NUMERO UNO , EJIDO MUNICIPIO CAMPO ELIAS, ESTADO MÉRIDA',
    ciudad: 'Mérida',
    localizacion: 'Merida',
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
    id: 'PROV-OSMAR-LARREAL',
    rif: 'V-39604368-0',
    razon_social: 'OSMAR LARREAL',
    persona_contacto: 'osmar categoria',
    contacto_nombre: 'osmar categoria',
    telefono: '0414656963',
    correo: '',
    direccion: 'AV. GUAJIRA, RESD. LAS VISTAS EDIF. LAS VISTAS 2, APTO 2-B',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'OTROS',
    creado_por_nombre: 'Analista Compras',
    actualizado_por_nombre: 'Analista Compras',
    creado_por: 'compras@totalclean.com',
    actualizado_por: 'compras@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-MEGA-SERVICE-1122',
    rif: 'V-30358687-0',
    razon_social: 'MEGA SERVICE 1122',
    persona_contacto: 'MEGA SERVICE',
    contacto_nombre: 'MEGA SERVICE',
    telefono: '0414-6318571',
    correo: '',
    direccion: 'AV. 17 ( LOS HATICOS ) N 116-142 DETRAS DEL COLEGIO EL BRILLANTE APDO 626',
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
    id: 'PROV-MEGAWRAPS',
    rif: 'J-50186970-7',
    razon_social: 'MEGAWRAPS, C.A.',
    persona_contacto: 'MEGAWRAPS',
    contacto_nombre: 'MEGAWRAPS',
    telefono: '04146979570',
    correo: 'marilyndelvalledelgado@gmail.com',
    direccion: 'AV 21 CASA NO. 4-50 BARRIO SIRRA MAESTRA MARACAIBO ESTADO ZULIA',
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
    id: 'PROV-MERVIN-PARRA',
    rif: 'V-14279769-7',
    razon_social: 'MERVIN J. PARRA R.',
    persona_contacto: 'MERVIN J PARRA',
    contacto_nombre: 'MERVIN J PARRA',
    telefono: '0424-6887319',
    correo: 'yeraldinhernandez190106@gmail.com',
    direccion: 'AV. 61 Nº. 113-36, SECTOR LOS ROBLES',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'AGUA Y HIELO',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-JOSE-YENDIZ',
    rif: 'V-20992211-0',
    razon_social: 'JOSE YENDIZ',
    persona_contacto: 'JOSE YENDIZ',
    contacto_nombre: 'JOSE YENDIZ',
    telefono: '0424-8966587',
    correo: '',
    direccion: 'SAN MATEO ESTADO ANZOATEGUI',
    ciudad: 'San Mateo',
    localizacion: 'SAN MATEO ESTADO ANZOATEGUI',
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
    id: 'PROV-JULIO-RICO',
    rif: 'V-09920701-0',
    razon_social: 'JULIO RICO',
    persona_contacto: 'JULIO RICO',
    contacto_nombre: 'JULIO RICO',
    telefono: '026153636398',
    correo: '',
    direccion: 'PIRITU EDO ANZOATEGUI',
    ciudad: 'Puerto Píritu',
    localizacion: 'PUERTO PIRITU EDO. ANOZATEGUI',
    categoria: 'ALQUILER',
    creado_por_nombre: 'Analista Compras',
    actualizado_por_nombre: 'Analista Compras',
    creado_por: 'compras@totalclean.com',
    actualizado_por: 'compras@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-KARIBBEAN',
    rif: 'J-31113105-1',
    razon_social: 'KARIBBEAN, C.A',
    persona_contacto: 'karibean',
    contacto_nombre: 'karibean',
    telefono: '04246183347',
    correo: '',
    direccion: 'av. 61 Entre calles 147 y 18A LOCAL NMRO y tapon parcela Cl-19 sector l local galpon nº 147-',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'EQUIPO, REPUESTO, SERVICIO',
    creado_por_nombre: 'Analista Compras',
    actualizado_por_nombre: 'Analista Compras',
    creado_por: 'compras@totalclean.com',
    actualizado_por: 'compras@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-CASA-DE-LAS-GUAYAS',
    rif: 'J-50687412-1',
    razon_social: 'LA CASA DE LAS GUAYAS 2025 C.A',
    persona_contacto: 'la casa de las guayas',
    contacto_nombre: 'la casa de las guayas',
    telefono: '04121006970',
    correo: '',
    direccion: 'AV 58 CON CALLE 18 Y 18A LOCAL NMRO 108-109 BARRIO SAN PEDRO MARACAIBO ZULIA ZONA POSTAL 4001',
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

async function syncBatch2() {
  console.log("Fetching current SYS-PROVEEDORES-CENTRAL record...");
  const { data: found } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, items')
    .eq('correlativo_req', 'SYS-PROVEEDORES-CENTRAL')
    .single();

  const masterObj = found.items[0] || {};
  const currentProvs = masterObj.proveedores || [];
  const currentHistory = masterObj.historial_modificaciones || [];

  const updatedProvs = deduplicarListaProveedores([...batch2Suppliers, ...currentProvs]);

  const newHistory = batch2Suppliers.map(s => ({
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
    usuario_nombre: s.creado_por_nombre || 'Renny Maestre',
    usuario_correo: s.creado_por || 'rmaestre@totalclean.com',
    fecha: new Date().toISOString()
  }));

  const histMap = new Map();
  [...newHistory, ...currentHistory].forEach(h => {
    if (h && h.id && !histMap.has(h.id)) {
      histMap.set(h.id, h);
    }
  });

  const mergedHistory = Array.from(histMap.values()).slice(0, 500);

  const payloadItems = [{
    tipo: 'DIRECTORIO_CENTRAL_PROVEEDORES',
    ultima_actualizacion: new Date().toISOString(),
    proveedores: updatedProvs,
    historial_modificaciones: mergedHistory
  }];

  const { error } = await supabase
    .from('requisiciones')
    .update({
      items: payloadItems,
      updated_at: new Date().toISOString()
    })
    .eq('id', found.id);

  console.log(`Update result error:`, error);
  console.log(`Total suppliers now in cloud: ${updatedProvs.length}`);
}

syncBatch2();
