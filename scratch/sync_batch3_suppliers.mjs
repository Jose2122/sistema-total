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

const batch3Suppliers = [
  {
    id: 'PROV-JHON-FRANK-MORGADO',
    rif: 'V-08294567-5',
    razon_social: 'JHON FRANK MORGADO',
    persona_contacto: 'JHON FRANK MORGADO',
    contacto_nombre: 'JHON FRANK MORGADO',
    telefono: '04123216369',
    correo: '',
    direccion: 'BARCELONA ESTADO ANZOATEGUI',
    ciudad: 'Barcelona',
    localizacion: 'BARCELONA ESTADO ANZOATEGUI',
    categoria: 'TRANSPORTE',
    creado_por_nombre: 'Analista Compras',
    actualizado_por_nombre: 'Analista Compras',
    creado_por: 'compras@totalclean.com',
    actualizado_por: 'compras@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-JHONNY-VALBUENA',
    rif: 'V-04995079-5',
    razon_social: 'JHONNY VALBUENA',
    persona_contacto: 'JHONNY VALBUENA',
    contacto_nombre: 'JHONNY VALBUENA',
    telefono: '04141656080',
    correo: 'marilyndelvalledelgado@gmail.com',
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
    id: 'PROV-JONATHAN-ANDRADE',
    rif: 'V-13001891-9',
    razon_social: 'JONATHAN ANDRADE',
    persona_contacto: 'JONATHAN ANDRADE',
    contacto_nombre: 'JONATHAN ANDRADE',
    telefono: '04143626803',
    correo: 'jonathanandrade@gmail.com',
    direccion: 'Maracaibo, Edo. Zulia',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'TECNOLOGÍA',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-INV-RAMIREZ',
    rif: 'J-50490259-4',
    razon_social: 'INVERSIONES RAMIREZ C.A',
    persona_contacto: 'INVERSIONES RAMIREZ',
    contacto_nombre: 'INVERSIONES RAMIREZ',
    telefono: '04246890510',
    correo: '',
    direccion: 'Urb San Francisco , sector 06 San Francisco Estado Zulia',
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
    id: 'PROV-ISABELA-TODO-FARIAS',
    rif: 'V-32797469-2',
    razon_social: 'ISABELA TODO FARIAS F.P',
    persona_contacto: 'ISABELA TODO FARIAS',
    contacto_nombre: 'ISABELA TODO FARIAS',
    telefono: '0412365965',
    correo: '',
    direccion: 'BARCELONA ESTADO ANZOATEGUI',
    ciudad: 'Barcelona',
    localizacion: 'BARCELONA ESTADO ANZOATEGUI',
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
    id: 'PROV-IWECOTECH',
    rif: 'J-31762771-7',
    razon_social: 'IWECOTECH',
    persona_contacto: 'IWOCOTECH',
    contacto_nombre: 'IWOCOTECH',
    telefono: '04146302218',
    correo: 'IWECOTECH@GMAIL.COM.VE',
    direccion: 'AV.17 CASCO CENTRAL,C.C AMAL NIVEL 2, LOCAL N 22 Y 23 , CABIMAS , ESTADO ZULIA',
    ciudad: 'Cabimas',
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
    id: 'PROV-IWOSA-HIERRO',
    rif: 'J-30365659-6',
    razon_social: 'IWOSA HIERRO ACERO FERRETERIA',
    persona_contacto: 'iwosa',
    contacto_nombre: 'iwosa',
    telefono: '0424659896',
    correo: '',
    direccion: 'AV 61 ENTRE CALLE 147 Y TAPON PARCELA CI GAL´PON NRO 147-113',
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
    id: 'PROV-JA-SISTEMAS',
    rif: '',
    razon_social: 'J.A. SISTEMAS',
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
    id: 'PROV-JAVIER-NAVA-FACCINI',
    rif: 'V-07796049-0',
    razon_social: 'JAVIER E. NAVA FACCINI',
    persona_contacto: 'JAVIER E NAVA',
    contacto_nombre: 'JAVIER E NAVA',
    telefono: '0412.968.24.81',
    correo: '',
    direccion: 'CALLE 70 EDIF.CAMELOT PISO PB APT 2 SECTOR TIERRA NEGRA MARACAIBO EDO. ZULIA',
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
    id: 'PROV-INV-TODO-LEONARDO',
    rif: 'V-11290860-6',
    razon_social: 'INVERSIONES TODO LEONARDO C.A.',
    persona_contacto: 'LEONARDO SANCHEZ',
    contacto_nombre: 'LEONARDO SANCHEZ',
    telefono: '04127643063',
    correo: 'ls11290820@gmail.com',
    direccion: 'CALLE 131 CASA 48-301 SECTOR SANATORIO MARACAIBO ZULIA',
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
    id: 'PROV-INVERMACO',
    rif: '',
    razon_social: 'INVERMACO C.A',
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
    id: 'PROV-INV-ADRIZORCA',
    rif: 'J-50744236-5',
    razon_social: 'INVERSIONES ADRIZORCA 2025, C.A.',
    persona_contacto: 'INVERSIONES ADRIZORCA',
    contacto_nombre: 'INVERSIONES ADRIZORCA',
    telefono: '0414-6368018',
    correo: 'adrianmadero723@gmail.com',
    direccion: 'AV. 21 CASA Nº S/N SECTOR BAJO GRANDE',
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
    id: 'PROV-INV-CHACHI',
    rif: '',
    razon_social: 'INVERSIONES CHACHI C.A',
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
    id: 'PROV-INV-GARCIAS-RIVAS',
    rif: 'J-41048564-7',
    razon_social: 'INVERSIONES GARCIAS RIVAS C.A',
    persona_contacto: 'INVERSIONES GARCIAS',
    contacto_nombre: 'INVERSIONES GARCIAS',
    telefono: '0424.605.28.51',
    correo: '',
    direccion: 'CALLE 107A CASA N23-23 BARRIO CONCEPCION PALACIOS MARACAIBO EDO ZULIA',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'LIMPIEZA',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-INV-JF-MURO',
    rif: '',
    razon_social: 'INVERSIONES JF MURO JOSE FRANCISCO MURO MENZEL F.P',
    persona_contacto: 'INVERSIONES JF MURO',
    contacto_nombre: 'INVERSIONES JF MURO',
    telefono: '04146308900',
    correo: '',
    direccion: 'Calle 13 AV9 CASA NRO 12-87 SECTOR SIERRA MAESTRA',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
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
    id: 'PROV-HUBY-CONNECT',
    rif: 'J-50168233-3',
    razon_social: 'HUBY CONNECT',
    persona_contacto: 'HUBY CONNECT',
    contacto_nombre: 'HUBY CONNECT',
    telefono: '04246708185',
    correo: '',
    direccion: 'AV 4 BELLA VISTA CALLE 76 EDIF CENTRO EMPRESARIAL PISO 1 LOCAL 15 SECTOR BELLA VISTA MARACAIBO ZULIA ZONA POSTAL 4005 SUCURSAL SAMBIL LOCAL COMERCIAL',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'TECNOLOGÍA',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-IMPORTADORA-CAUCHO',
    rif: '',
    razon_social: 'IMPORTADORA DE CAUCHO',
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
    id: 'PROV-INDRINA-CARVAJALINO',
    rif: 'V-21216921-7',
    razon_social: 'INDRINA CARVAJALINO',
    persona_contacto: 'INDRINA',
    contacto_nombre: 'INDRINA',
    telefono: '0424-648.48.98',
    correo: '',
    direccion: 'km 44 VIA PERIJA CASA S/N SECTOR LA ESTRELLA BOLIVARIANA KM 50 LA CAÑADA DE URDANETA ZULIA',
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
    id: 'PROV-HIDROBOMBAS-SUR',
    rif: 'J-40156868-8',
    razon_social: 'HIDROBOMBAS SUR , C. A',
    persona_contacto: 'hidrobombas',
    contacto_nombre: 'hidrobombas',
    telefono: '02617651143',
    correo: '',
    direccion: 'CALLE 61 CC OCANDO CASTILLO NIVEL 69',
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

async function syncBatch3() {
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

  batch3Suppliers.forEach(newProv => {
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

  console.log(`\n🎉 Sincronización Batch 3 exitosa!`);
  console.log(`- Actualizados: ${updatedCount}`);
  console.log(`- Nuevos agregados: ${addedCount}`);
  console.log(`- Total en nube: ${existingProvs.length}`);
}

syncBatch3();
