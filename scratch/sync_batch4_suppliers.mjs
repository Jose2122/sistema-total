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

const batch4Suppliers = [
  {
    id: 'PROV-FERRETERIA-CLEMA',
    rif: 'J-00014288-2',
    razon_social: 'FERRETERIA CLEMA, C.A.',
    persona_contacto: 'FERRETERIA CLEMA',
    contacto_nombre: 'FERRETERIA CLEMA',
    telefono: '0283-2416141',
    correo: '',
    direccion: 'AV. FRANCISCO DE MIRANDA NRO 132 SECTOR PUEBLO NUEVO SUR',
    ciudad: 'Miranda',
    localizacion: 'miranda',
    categoria: 'FERRETERÍA, MANTENIMIENTO',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
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
    id: 'PROV-FERRETERIA-RONACA',
    rif: '',
    razon_social: 'FERRETERIA RONACA',
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
    id: 'PROV-FILTROS-LUBRICANTES-PUENTE',
    rif: 'J-40183731-9',
    razon_social: 'FILTROS Y LUBRICANTES EL PUENTE C.A.',
    persona_contacto: 'filtros y lubricantes',
    contacto_nombre: 'filtros y lubricantes',
    telefono: '04146606115',
    correo: '',
    direccion: 'CTERA CIRCUNVALACION NO. 1, LOCAL NO. 105-05 NO. SECTOR SANTE CLARA MARACAIBO ESTADO',
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
    id: 'PROV-FABIO-DE-CASTRO',
    rif: 'E-81255986-6',
    razon_social: 'FABIO DE CASTRO (FC)',
    persona_contacto: 'FABIO DE CASTRO',
    contacto_nombre: 'FABIO DE CASTRO',
    telefono: '04143600139',
    correo: 'FABIODECASTRO098@GMAIL.COM',
    direccion: 'CALLE 96E.NO 55-79 URB. LA PAZ',
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
    id: 'PROV-FABRIEMPACUES',
    rif: '',
    razon_social: 'FABRIEMPACUES',
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
    id: 'PROV-FARMAEXPRESS-CA',
    rif: 'J-58632369-5',
    razon_social: 'FARMAEXPRESS C.A',
    persona_contacto: 'FARMAEXRESS',
    contacto_nombre: 'FARMAEXRESS',
    telefono: '0424658963',
    correo: '',
    direccion: 'AV CIRCUNVALACION 2 ENTRE CALLE 97 Y 97A CC SAN TARCITO PB',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'SERVICIO MEDICO',
    creado_por_nombre: 'Analista Compras',
    actualizado_por_nombre: 'Analista Compras',
    creado_por: 'compras@totalclean.com',
    actualizado_por: 'compras@totalclean.com',
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
    id: 'PROV-FARMATODO',
    rif: 'J-00020200-1',
    razon_social: 'FARMATODO',
    persona_contacto: 'farmatodo',
    contacto_nombre: 'farmatodo',
    telefono: '0414869632',
    correo: '',
    direccion: 'AV LOS GUAYABITOS C EXPRESO BARUTA NIVEL 5 OF UNICA URB LA TRINIDAD',
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
    id: 'PROV-FAVEMOCA',
    rif: 'J-30138066-5',
    razon_social: 'FAVEMOCA',
    persona_contacto: 'FAVEMOCA',
    contacto_nombre: 'FAVEMOCA',
    telefono: '0414659865',
    correo: '',
    direccion: 'DIRECION CRTRA VIAL A PALITO BLANCO SECTOR LA REINA JARDIN BOTANICO',
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
    id: 'PROV-EMP-NAC-MECANICA',
    rif: 'J-50317397-0',
    razon_social: 'EMPRESA NACIONAL DE MECANICA , C.A.',
    persona_contacto: 'empresa nacional de mecanica',
    contacto_nombre: 'empresa nacional de mecanica',
    telefono: '04146491326',
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
    id: 'PROV-EMP-NAC-MWCANICA-EMNAMECA',
    rif: 'J-50817397-0',
    razon_social: 'EMPRESA NACIONAL DE MWCANICA, C.A. ( EMNAMECA ) AUTO REFRIGERACION',
    persona_contacto: 'EMNAMECA',
    contacto_nombre: 'EMNAMECA',
    telefono: '04126459632',
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
    id: 'PROV-ENARGER',
    rif: '',
    razon_social: 'ENARGER',
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
    id: 'PROV-EQUIPAMIENTO-TECNOLOGICO',
    rif: '',
    razon_social: 'EQUIPAMIENTO TECNOLOGICO C.A',
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
    id: 'PROV-ESNELL-SIFONTES',
    rif: 'V-08560702-0',
    razon_social: 'ESNELL SIFONTES',
    persona_contacto: 'esnell sifontes',
    contacto_nombre: 'esnell sifontes',
    telefono: '04248740491',
    correo: '',
    direccion: 'POZUELOS EDO. ANZOATEGUI',
    ciudad: 'Pozuelos',
    localizacion: 'POZUELOS EDO. ANZOATEGUI',
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
    id: 'PROV-EURO-ENRIQUE-GONZALEZ',
    rif: 'V-12380040-7',
    razon_social: 'EURO ENRIQUE GONZALEZ GONZALEZ ( ELETROMECANICA AUTOMOTRIZ )',
    persona_contacto: 'EURO ENRIQUE',
    contacto_nombre: 'EURO ENRIQUE',
    telefono: '0416-229.32.92',
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
    id: 'PROV-DON-JUAN-MULTISERVICIOS',
    rif: 'J-30365668-7',
    razon_social: 'DON JUAN MULTISERVICIOS ELETRO MECANICA',
    persona_contacto: 'DON JUAN',
    contacto_nombre: 'DON JUAN',
    telefono: '0416-0617810',
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
    id: 'PROV-DOUGLAS-MORAN',
    rif: 'V-18723220-8',
    razon_social: 'DOUGLAS ENRIQUE MORAN SENCIAL',
    persona_contacto: 'douglas enrique',
    contacto_nombre: 'douglas enrique',
    telefono: '04246697614',
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
    id: 'PROV-EFA-SISTEMAS',
    rif: 'J-50092940-4',
    razon_social: 'EFA SISTEMAS C, A',
    persona_contacto: 'efa sistemas',
    contacto_nombre: 'efa sistemas',
    telefono: '0412-172-7481',
    correo: '',
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
    id: 'PROV-EL-FOGON-CRIOLLO',
    rif: 'J-40689947-0',
    razon_social: 'EL FOGON CRIOLLO DE MERCEDES C.A',
    persona_contacto: 'EL FOGON',
    contacto_nombre: 'EL FOGON',
    telefono: '0424698632',
    correo: '',
    direccion: 'BARCELONA ESTADO ANZOATEGUI',
    ciudad: 'Barcelona',
    localizacion: 'BARCELONA ESTADO ANZOATEGUI',
    categoria: 'ALIMENTACIÓN',
    creado_por_nombre: 'Analista Compras',
    actualizado_por_nombre: 'Analista Compras',
    creado_por: 'compras@totalclean.com',
    actualizado_por: 'compras@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-ELCA-TELECOMUNICACIONES',
    rif: 'J-30594070-3',
    razon_social: 'ELCA TELECOMUNICACIONES,CA',
    persona_contacto: 'elca telecomunicacion',
    contacto_nombre: 'elca telecomunicacion',
    telefono: '0414653698',
    correo: 'cobranzas@elcatelecom.com',
    direccion: 'Maracaibo, Edo. Zulia',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'RADIOS',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-ELECTRO-SERVICIOS-GUAYANA',
    rif: 'J-08035082-0',
    razon_social: 'ELECTRO SERVICIOS GUAYANA',
    persona_contacto: 'eletro servicios',
    contacto_nombre: 'eletro servicios',
    telefono: '04148234901',
    correo: '',
    direccion: 'POZUELOS EDO. ANZOATEGUI',
    ciudad: 'Pozuelos',
    localizacion: 'POZUELOS EDO. ANZOATEGUI',
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
    id: 'PROV-EMBRAGUES-BOMBAS-ZULIA',
    rif: 'J-40856087-9',
    razon_social: 'EMBRAGUES Y BOMBAS ZULIA, C.A EMBOZULCA',
    persona_contacto: 'embragues y bombas',
    contacto_nombre: 'embragues y bombas',
    telefono: '0424-6861342',
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
    id: 'PROV-COMPRESORES-EL-4',
    rif: 'J-50177212-6',
    razon_social: 'COMPRESORES EL 4, C.A.',
    persona_contacto: 'compresores el 4',
    contacto_nombre: 'compresores el 4',
    telefono: '04121290176',
    correo: 'compresoresel4@gmail.com',
    direccion: 'Maracaibo, Edo. Zulia',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
    categoria: 'EQUIPO, REPUESTO',
    creado_por_nombre: 'Renny Maestre',
    actualizado_por_nombre: 'Renny Maestre',
    creado_por: 'rmaestre@totalclean.com',
    actualizado_por: 'rmaestre@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-CONSTRUCTORA-OMP',
    rif: 'J-29589543-7',
    razon_social: 'CONSTRUCTORA OMP C.A',
    persona_contacto: 'OMP',
    contacto_nombre: 'OMP',
    telefono: '0 (424) 679.9216.',
    correo: '',
    direccion: 'PUERTO PIRITU EDO. ANOZATEGUI',
    ciudad: 'Puerto Píritu',
    localizacion: 'PUERTO PIRITU EDO. ANOZATEGUI',
    categoria: 'CONSUMIBLE',
    creado_por_nombre: 'Analista Compras',
    actualizado_por_nombre: 'Analista Compras',
    creado_por: 'compras@totalclean.com',
    actualizado_por: 'compras@totalclean.com',
    status: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'PROV-COPCENTER-LA-POPULAR',
    rif: 'J-40669473-8',
    razon_social: 'COPCENTER LA POPULAR',
    persona_contacto: 'papeleria',
    contacto_nombre: 'papeleria',
    telefono: '04149658109',
    correo: '',
    direccion: 'Maracaibo, Edo. Zulia',
    ciudad: 'Maracaibo',
    localizacion: 'Maracaibo',
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
    id: 'PROV-DAKA',
    rif: '',
    razon_social: 'DAKA',
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
    id: 'PROV-DALIA-HERRERA',
    rif: 'V-10948019-0',
    razon_social: 'DALIA JOSEFINA HERRERA CANDURI',
    persona_contacto: 'PAPELERIA',
    contacto_nombre: 'PAPELERIA',
    telefono: '0414635965',
    correo: '',
    direccion: 'POZUELOS EDO. ANZOATEGUI',
    ciudad: 'Pozuelos',
    localizacion: 'POZUELOS EDO. ANZOATEGUI',
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
    id: 'PROV-DENNIS-RAMIREZ',
    rif: 'V-13912383-9',
    razon_social: 'DENNIS RAMIREZ MACHADO',
    persona_contacto: 'dennis ramirez',
    contacto_nombre: 'dennis ramirez',
    telefono: '0412-0719836',
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

async function syncBatch4() {
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

  batch4Suppliers.forEach(newProv => {
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

  console.log(`\n🎉 Sincronización Batch 4 exitosa!`);
  console.log(`- Actualizados: ${updatedCount}`);
  console.log(`- Nuevos agregados: ${addedCount}`);
  console.log(`- Total en nube: ${existingProvs.length}`);
}

syncBatch4();
