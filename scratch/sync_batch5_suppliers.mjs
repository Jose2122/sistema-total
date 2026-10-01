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

const batch5Suppliers = [
  {
    id: 'PROV-CAUCHOS-SORA',
    rif: 'J-30045684-6',
    razon_social: 'CAUCHOS SORA C.A',
    persona_contacto: 'CAUCHOS SORA',
    contacto_nombre: 'CAUCHOS SORA',
    telefono: '',
    correo: '',
    direccion: 'LECHERIA ESTADO ANZOATEGUI',
    ciudad: 'Lecheria',
    localizacion: 'LECHERIA ESTADO ANZOATEGUI',
    categoria: 'CONSUMIBLE',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-CAUCHOS-TRIPLE',
    rif: '',
    razon_social: 'CAUCHOS TRIPLE',
    persona_contacto: 'Sin contacto',
    contacto_nombre: '',
    telefono: '',
    correo: '',
    direccion: '',
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
    id: 'PROV-CACIQUE-MANAURE',
    rif: 'J-30089263-8',
    razon_social: 'CENTRO DE ADIESTRAMIENTO Y DESARROLLO INTEGRAL CACIQUE MANAURE',
    persona_contacto: 'CACIQUE MANAURE',
    contacto_nombre: 'CACIQUE MANAURE',
    telefono: '',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'OTROS, ESTUDIOS',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-EDICION-INTEGRAL',
    rif: 'J-30593070-8',
    razon_social: 'CENTRO EDICIÓN INTEGRAL C.A',
    persona_contacto: 'EDICION INTEGRAL',
    contacto_nombre: 'EDICION INTEGRAL',
    telefono: '',
    correo: '',
    direccion: 'LECHERIA ESTADO ANZOATEGUI',
    ciudad: 'Lecheria',
    localizacion: 'LECHERIA ESTADO ANZOATEGUI',
    categoria: 'PAPELERÍA',
    creado_por_nombre: 'Analista Compras',
    actualizado_por_nombre: 'Analista Compras',
    creado_por: 'compras@totalclean.com',
    actualizado_por: 'compras@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-PIRITU-INN',
    rif: 'J-29616859-4',
    razon_social: 'CENTRO PIRITU INN C.A',
    persona_contacto: 'CENTRO PIRITU INN',
    contacto_nombre: 'CENTRO PIRITU INN',
    telefono: '',
    correo: '',
    direccion: 'LECHERIA ESTADO ANZOATEGUI',
    ciudad: 'Lecheria',
    localizacion: 'LECHERIA ESTADO ANZOATEGUI',
    categoria: 'HOSPEDAJE',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-COFTAH',
    rif: 'J-30713850-5',
    razon_social: 'COFTAH',
    persona_contacto: 'COFTAH',
    contacto_nombre: 'COFTAH',
    telefono: '',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'ESTUDIOS',
    creado_por_nombre: 'Analista Compras',
    actualizado_por_nombre: 'Analista Compras',
    creado_por: 'compras@totalclean.com',
    actualizado_por: 'compras@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-MARRERO',
    rif: 'J-50034104-0',
    razon_social: 'COMERIALIZADORA E INVERSIONES MARRERO,C.A.',
    persona_contacto: 'COMERCIALIZADORA MARRERO',
    contacto_nombre: 'COMERCIALIZADORA MARRERO',
    telefono: '',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'TRANSPORTE',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-BATOR',
    rif: 'J-31601550-5',
    razon_social: 'BATOR',
    persona_contacto: 'BATOR',
    contacto_nombre: 'BATOR',
    telefono: '04248935549',
    correo: '',
    direccion: 'LECHERIA ESTADO ANZOATEGUI',
    ciudad: 'Lecheria',
    localizacion: 'LECHERIA ESTADO ANZOATEGUI',
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
    id: 'PROV-BICOLOR',
    rif: 'J-07017217-7',
    razon_social: 'BICOLOR C.A',
    persona_contacto: 'bicolor',
    contacto_nombre: 'bicolor',
    telefono: '0424636986',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'FERRETERÍA',
    creado_por_nombre: 'Analista Compras',
    actualizado_por_nombre: 'Analista Compras',
    creado_por: 'compras@totalclean.com',
    actualizado_por: 'compras@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-BLANCA-NIEVES',
    rif: 'V-11582145-7',
    razon_social: 'BLANCA NIEVES ALONSO CASTRO',
    persona_contacto: 'blanca nieves alonso castro',
    contacto_nombre: 'blanca nieves alonso castro',
    telefono: '0424596632',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
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
    id: 'PROV-BOBINA-SANTA-ROSA',
    rif: 'J-40004091-4',
    razon_social: 'BOBINA SANTA ROSA C.A',
    persona_contacto: 'bobina',
    contacto_nombre: 'bobina',
    telefono: '04163663131',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
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
    id: 'PROV-BRIAN-ZAMBRANO',
    rif: '',
    razon_social: 'BRIAN J ZAMBRANO M.',
    persona_contacto: 'Sin contacto',
    contacto_nombre: '',
    telefono: '',
    correo: '',
    direccion: '',
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
    id: 'PROV-CAUCHO-VERITAS',
    rif: '',
    razon_social: 'CAUCHO VERITAS C.A',
    persona_contacto: 'Sin contacto',
    contacto_nombre: '',
    telefono: '',
    correo: '',
    direccion: '',
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
    id: 'PROV-CAUCHOS-DELICIAS',
    rif: 'J-30726213-3',
    razon_social: 'CAUCHOS CENTER LAS DELICIAS, C.A.',
    persona_contacto: 'cauchos center',
    contacto_nombre: 'cauchos center',
    telefono: '0261-7521340',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
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
    id: 'PROV-ALVAREZ-ALVAREZ',
    rif: 'J-50254615-4',
    razon_social: 'ALVAREZ ALVAREZ & ASOCIADOSS',
    persona_contacto: 'ALVAREZ ALVAREZ',
    contacto_nombre: 'ALVAREZ ALVAREZ',
    telefono: '',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'MANTENIMIENTO, MANO DE OBRA',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-ANDRY-GONZALEZ',
    rif: 'V-20370510-3',
    razon_social: 'ANDRY GONZALEZ E INVERSIONES',
    persona_contacto: 'ANDRY GONZALEZ',
    contacto_nombre: 'ANDRY GONZALEZ',
    telefono: '',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'OTROS, SUMINISTRO DE AGUA',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-AP-TRUCK',
    rif: 'J-50488657-6',
    razon_social: 'AP TRUCK C.A',
    persona_contacto: 'AP TRUCK',
    contacto_nombre: 'AP TRUCK',
    telefono: '',
    correo: '',
    direccion: 'BARCELONA ESTADO ANZOATEGUI',
    ciudad: 'Barcelona',
    localizacion: 'BARCELONA ESTADO ANZOATEGUI',
    categoria: 'REPUESTO',
    creado_por_nombre: 'Analista Compras',
    actualizado_por_nombre: 'Analista Compras',
    creado_por: 'compras@totalclean.com',
    actualizado_por: 'compras@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-ASERRADERO-ORENSE',
    rif: '',
    razon_social: 'ASERRADERO ORENSE',
    persona_contacto: 'Sin contacto',
    contacto_nombre: '',
    telefono: '',
    correo: '',
    direccion: '',
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
    id: 'PROV-COOP-SOLUCIONES-GENERALES',
    rif: 'J-29780707-1',
    razon_social: 'ASOCIACION COOPERATIVA SOLUCIONES GENERALES EMPRESARIALES R.L',
    persona_contacto: 'SOLUCIONES GENERALES',
    contacto_nombre: 'SOLUCIONES GENERALES',
    telefono: '',
    correo: '',
    direccion: 'PUERTO PIRITU EDO. ANOZATEGUI',
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
    id: 'PROV-AUTO-PARTES-EH',
    rif: 'J-40558032-1',
    razon_social: 'AUTO PARTES EH, C.A',
    persona_contacto: 'AUTO PARTES EH',
    contacto_nombre: 'AUTO PARTES EH',
    telefono: '',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
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
    id: 'PROV-AIR-MAX',
    rif: 'J-50582768-5',
    razon_social: 'AIR MAX COMPRESORES C.A,',
    persona_contacto: 'AIR MAX COMPRESORES',
    contacto_nombre: 'AIR MAX COMPRESORES',
    telefono: '',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
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
    id: 'PROV-ALFONSO-ARENDS',
    rif: 'V-07826676-3',
    razon_social: 'ALFONSO GREGORIO ARENDS CEBALLOS C.A',
    persona_contacto: 'ALFONSO ARENDS',
    contacto_nombre: 'ALFONSO ARENDS',
    telefono: '',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'SERVICIO',
    creado_por_nombre: 'Analista Compras',
    actualizado_por_nombre: 'Analista Compras',
    creado_por: 'compras@totalclean.com',
    actualizado_por: 'compras@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-ALI-GARCIA',
    rif: 'V-09730875-2',
    razon_social: 'ALI SEGUNDO GARCIA QUINTERO',
    persona_contacto: 'ALI GARCIA',
    contacto_nombre: 'ALI GARCIA',
    telefono: '',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'PINTURAS, OTROS, MANO DE OBRA',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-ALIRIO-HUERTA',
    rif: 'V-18987383-9',
    razon_social: 'ALIRIO JOSE HUERTA OLIVARES TU TAPICERIA',
    persona_contacto: 'ALIRIO HUERTA',
    contacto_nombre: 'ALIRIO HUERTA',
    telefono: '',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
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
    id: 'PROV-ALKOSTO',
    rif: 'J-58695231-4',
    razon_social: 'ALKOSTO',
    persona_contacto: 'ALKOSTO',
    contacto_nombre: 'ALKOSTO',
    telefono: '',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
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
    id: 'PROV-AH-SUPPLY',
    rif: 'J-40454759-2',
    razon_social: 'A&H SUPPLY.C.A',
    persona_contacto: 'JUAN',
    contacto_nombre: 'JUAN',
    telefono: '0414-6575118',
    correo: 'HLSUPPLYCA@HOTMAIL.COM',
    direccion: 'Maracaibo, Edo. Zulia',
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
    id: 'PROV-ACRILICOS-FRAN-COLORS',
    rif: 'J-31559921-0',
    razon_social: 'ACRRILICOS FRAN COLORS C.A',
    persona_contacto: 'ACRILICOS',
    contacto_nombre: 'ACRILICOS',
    telefono: '04227003727',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
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
  let core = nums;
  if (nums.length >= 9) {
    core = nums.substring(0, 8);
  } else if (nums.length === 8) {
    core = nums.substring(0, 7);
  }
  return { raw, nums, core };
};

const sonProveedoresCoincidentes = (p1, p2) => {
  if (!p1 || !p2) return false;
  const rif1 = extraerCoreRif(p1.rif);
  const rif2 = extraerCoreRif(p2.rif);

  if (rif1.nums && rif2.nums && rif1.nums.length >= 7 && rif2.nums.length >= 7) {
    if (rif1.nums === rif2.nums) return true;
    if (rif1.core && rif2.core && rif1.core === rif2.core) return true;
    return false;
  }

  const norm1 = normalizarNombreEmpresa(p1.razon_social || p1.nombre);
  const norm2 = normalizarNombreEmpresa(p2.razon_social || p2.nombre);

  if (norm1 && norm2) {
    if (norm1 === norm2) return true;
    if (norm1.length >= 5 && norm2.length >= 5) {
      if (norm1.startsWith(norm2) || norm2.startsWith(norm1)) return true;
    }
  }

  return false;
};

async function syncBatch5() {
  console.log('Fetching central directory from cloud...');
  const { data: centralRecord, error: fetchErr } = await supabase
    .from('requisiciones')
    .select('id, correlativo_req, items')
    .eq('correlativo_req', 'SYS-PROVEEDORES-CENTRAL')
    .single();

  if (fetchErr || !centralRecord) {
    console.error('Error fetching central record:', fetchErr);
    return;
  }

  const existingProvs = (centralRecord.items && centralRecord.items[0] && centralRecord.items[0].proveedores) || [];
  console.log(`Current cloud directory count: ${existingProvs.length} suppliers.`);

  let updatedCount = 0;
  let addedCount = 0;

  batch5Suppliers.forEach(newProv => {
    const idx = existingProvs.findIndex(p => sonProveedoresCoincidentes(p, newProv));
    if (idx >= 0) {
      existingProvs[idx] = {
        ...existingProvs[idx],
        ...newProv,
        id: existingProvs[idx].id || newProv.id,
        historial_compras: existingProvs[idx].historial_compras || [],
        total_compras: existingProvs[idx].total_compras || 0,
        monto_total_comprado: existingProvs[idx].monto_total_comprado || 0,
        updated_at: new Date().toISOString()
      };
      console.log(`🔄 Actualizado existente: [${newProv.rif || 'Sin RIF'}] ${newProv.razon_social}`);
      updatedCount++;
    } else {
      existingProvs.push({
        ...newProv,
        historial_compras: [],
        total_compras: 0,
        monto_total_comprado: 0
      });
      console.log(`➕ Agregado nuevo: [${newProv.rif || 'Sin RIF'}] ${newProv.razon_social}`);
      addedCount++;
    }
  });

  console.log(`\nWriting back to cloud (${existingProvs.length} total suppliers)...`);
  const { error: updateErr } = await supabase
    .from('requisiciones')
    .update({
      items: [{
        ...centralRecord.items[0],
        proveedores: existingProvs,
        ultima_actualizacion: new Date().toISOString(),
        total_proveedores: existingProvs.length
      }],
      updated_at: new Date().toISOString()
    })
    .eq('id', centralRecord.id);

  if (updateErr) {
    console.error('Error updating central record:', updateErr);
    return;
  }

  console.log(`\n🎉 Sincronización Batch 5 exitosa!`);
  console.log(`- Actualizados: ${updatedCount}`);
  console.log(`- Nuevos agregados: ${addedCount}`);
  console.log(`- Total en nube: ${existingProvs.length}`);
}

syncBatch5();
