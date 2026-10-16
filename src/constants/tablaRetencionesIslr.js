// =============================================================================
// TABLA OFICIAL DE RETENCIONES DEL I.S.L.R. (DECRETO 1.808 - ARTÍCULO 9)
// BASADO EN EL TABULADOR SENIAT / GRANT THORNTON (G.O. 43.140 - UT Bs. 43,00)
// =============================================================================

export const VALOR_UT_DEFAULT = 43.00;
export const FACTOR_SUSTRAENDO_UT = 83.3334; // Decreto 1.808 Art. 9 Parágrafo Segundo

/**
 * Calcula el monto límite a partir del cual aplica retención con sustraendo para PNR
 * (83.3334 * UT = Bs. 3.583,34 con UT de Bs. 43)
 */
export const calcularMontoMinimoSustraendoBs = (ut = VALOR_UT_DEFAULT) => {
  return Math.round((FACTOR_SUSTRAENDO_UT * (Number(ut) || VALOR_UT_DEFAULT)) * 100) / 100;
};

/**
 * Tipos de contribuyente / Sujetos Pasivos de Retención
 */
export const TIPOS_PERSONA_ISLR = [
  { id: 'PJD', codigo: 'PJD', label: 'Persona Jurídica Domiciliada', short: 'PJD (C.A. / S.A. / RIF J-)', rifPrefixes: ['J', 'G'] },
  { id: 'PNR', codigo: 'PNR', label: 'Persona Natural Residente', short: 'PNR (Residente / RIF V- / E-)', rifPrefixes: ['V', 'E'] },
  { id: 'PJND', codigo: 'PJND', label: 'Persona Jurídica No Domiciliada', short: 'PJND (Extranjera)', rifPrefixes: [] },
  { id: 'PNNR', codigo: 'PNNR', label: 'Persona Natural No Residente', short: 'PNNR (No Residente)', rifPrefixes: [] }
];

/**
 * Tabulador exhaustivo de conceptos del Decreto 1.808 Art. 9
 */
export const CONCEPTOS_RETENCION_ISLR = [
  // --- 9.11 SERVICIOS GENERALES ---
  {
    id: 'servicios_general',
    numeral: '9.11',
    nombre: 'Servicios (Ejecución de Obras, Servicios Técnicos, Contratistas, Mantenimiento, Reparaciones)',
    nombreCorto: 'Servicios (9.11)',
    categoria: 'Servicios',
    frecuente: true,
    tarifas: {
      PJD: { codigo: '055', base: 100, porcentaje: 2.00, sustraendoFactor: 0 },
      PNR: { codigo: '053', base: 100, porcentaje: 1.00, sustraendoFactor: 1.00, aplicaMinimo: true }, // 35.83 Bs
      PJND: { codigo: '056', base: 100, porcentaje: 5.00, sustraendoFactor: 0, nota: 'Tarifa Nº 2' },
      PNNR: { codigo: '054', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.15 FLETES Y TRANSPORTE NACIONAL ---
  {
    id: 'fletes_nacional',
    numeral: '9.15',
    nombre: 'Fletes y Gastos de Transporte Nacional (Carga, Mudanzas, Logística Terrestre)',
    nombreCorto: 'Fletes Nacionales (9.15)',
    categoria: 'Transporte',
    frecuente: true,
    tarifas: {
      PJD: { codigo: '072', base: 100, porcentaje: 3.00, sustraendoFactor: 0 },
      PNR: { codigo: '071', base: 100, porcentaje: 1.00, sustraendoFactor: 1.00, aplicaMinimo: true }, // 35.83 Bs
      PJND: { codigo: '031', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '030', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.1.b HONORARIOS PROFESIONALES ---
  {
    id: 'honorarios_profesionales',
    numeral: '9.1.b',
    nombre: 'Honorarios Profesionales (Asesorías, Consultorías, Contabilidad, Abogados, Ingenieros)',
    nombreCorto: 'Honorarios Profesionales (9.1.b)',
    categoria: 'Honorarios',
    frecuente: true,
    tarifas: {
      PJD: { codigo: '004', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '002', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true }, // 107.50 Bs
      PJND: { codigo: '005', base: 90, porcentaje: 5.00, sustraendoFactor: 0, nota: 'Tarifa Nº 2' },
      PNNR: { codigo: '003', base: 90, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.12 ARRENDAMIENTO BIENES INMUEBLES ---
  {
    id: 'arrendamiento_inmuebles',
    numeral: '9.12',
    nombre: 'Arrendamiento de Bienes Inmuebles (Alquiler de Galpones, Locales, Oficinas)',
    nombreCorto: 'Alquiler Inmuebles (9.12)',
    categoria: 'Arrendamiento',
    frecuente: true,
    tarifas: {
      PJD: { codigo: '059', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '057', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true }, // 107.50 Bs
      PJND: { codigo: '060', base: 100, porcentaje: 5.00, sustraendoFactor: 0, nota: 'Tarifa Nº 2' },
      PNNR: { codigo: '058', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.13 ARRENDAMIENTO BIENES MUEBLES ---
  {
    id: 'arrendamiento_muebles',
    numeral: '9.13',
    nombre: 'Arrendamiento de Bienes Muebles (Alquiler de Vehículos, Maquinaria, Equipos y Herramientas)',
    nombreCorto: 'Alquiler Equipos/Maquinaria (9.13)',
    categoria: 'Arrendamiento',
    frecuente: true,
    tarifas: {
      PJD: { codigo: '063', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '061', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true }, // 107.50 Bs
      PJND: { codigo: '064', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '062', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.19 PUBLICIDAD Y PROPAGANDA ---
  {
    id: 'publicidad_propaganda',
    numeral: '9.19',
    nombre: 'Publicidad y Propaganda (Medios Digitales, Impresos, Vallas, Redes)',
    nombreCorto: 'Publicidad y Propaganda (9.19)',
    categoria: 'Publicidad',
    frecuente: true,
    tarifas: {
      PJD: { codigo: '084', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '083', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true }, // 107.50 Bs
      PJND: { codigo: '085', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '083', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.19 PUBLICIDAD EMISORAS DE RADIO ---
  {
    id: 'publicidad_radio',
    numeral: '9.19',
    nombre: 'Publicidad y Propaganda Emisoras de Radio',
    nombreCorto: 'Publicidad Radio (9.19)',
    categoria: 'Publicidad',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '086', base: 100, porcentaje: 3.00, sustraendoFactor: 0 },
      PNR: { codigo: '083', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true },
      PJND: { codigo: '085', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '083', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.2.b COMISIONES MERCANTILES Y OTRAS ---
  {
    id: 'comisiones_mercantiles',
    numeral: '9.2.b',
    nombre: 'Comisiones Mercantiles y Otras',
    nombreCorto: 'Comisiones Mercantiles (9.2.b)',
    categoria: 'Comisiones',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '020', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '018', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true },
      PJND: { codigo: '021', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '019', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.2.a COMISIONES ENAJENACIÓN INMUEBLES ---
  {
    id: 'comisiones_inmuebles',
    numeral: '9.2.a',
    nombre: 'Comisiones por Enajenación de Inmuebles',
    nombreCorto: 'Comisiones Inmuebles (9.2.a)',
    categoria: 'Comisiones',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '016', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '014', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true },
      PJND: { codigo: '017', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '015', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.1.c HONORARIOS EN HIPÓDROMOS ---
  {
    id: 'honorarios_hipodromos',
    numeral: '9.1.c',
    nombre: 'Honorarios Profesionales en Hipódromos',
    nombreCorto: 'Honorarios Hipódromos (9.1.c)',
    categoria: 'Honorarios',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '004', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '010', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true },
      PJND: { codigo: '005', base: 90, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '011', base: 90, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.1.d HONORARIOS EN CENTROS DE SALUD ---
  {
    id: 'honorarios_salud',
    numeral: '9.1.d',
    nombre: 'Honorarios Profesionales en Centros de Salud',
    nombreCorto: 'Honorarios Salud (9.1.d)',
    categoria: 'Honorarios',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '004', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '012', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true },
      PJND: { codigo: '005', base: 90, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '013', base: 90, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.3.c INTERESES ---
  {
    id: 'intereses_general',
    numeral: '9.3.c',
    nombre: 'Intereses de Capitales y Rendimientos Financieros',
    nombreCorto: 'Intereses (9.3.c)',
    categoria: 'Financiero',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '027', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '025', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true },
      PJND: { codigo: '028', base: 95, porcentaje: 5.00, sustraendoFactor: 0, nota: 'Tarifa Nº 2' },
      PNNR: { codigo: '026', base: 95, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.3.a INTERESES ART. 27 # 2 LISLR ---
  {
    id: 'intereses_art27',
    numeral: '9.3.a',
    nombre: 'Intereses Art. 27 # 2 L.I.S.L.R.',
    nombreCorto: 'Intereses Art. 27 (9.3.a)',
    categoria: 'Financiero',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '027', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '025', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true },
      PJND: { codigo: '023', base: 95, porcentaje: 5.00, sustraendoFactor: 0, nota: 'Tarifa Nº 2' },
      PNNR: { codigo: '022', base: 95, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.3.b INTERESES ART. 52 PARAGRAFO 2º LISLR ---
  {
    id: 'intereses_art52',
    numeral: '9.3.b',
    nombre: 'Intereses Art. 52 Parágrafo 2º L.I.S.L.R.',
    nombreCorto: 'Intereses Art. 52 (9.3.b)',
    categoria: 'Financiero',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '027', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '025', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true },
      PJND: { codigo: '024', base: 100, porcentaje: 4.95, sustraendoFactor: 0 },
      PNNR: { codigo: '026', base: 95, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.4 AGENCIAS NOTICIAS INTERNACIONALES ---
  {
    id: 'agencias_noticias',
    numeral: '9.4',
    nombre: 'Agencias de Noticias Internacionales Art. 35 LISLR',
    nombreCorto: 'Noticias Internac. (9.4)',
    categoria: 'Internacional',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '055', base: 100, porcentaje: 2.00, sustraendoFactor: 0 },
      PNR: { codigo: '053', base: 100, porcentaje: 1.00, sustraendoFactor: 1.00, aplicaMinimo: true },
      PJND: { codigo: '029', base: 15, porcentaje: 5.00, sustraendoFactor: 0, nota: 'Tarifa Nº 2' },
      PNNR: { codigo: '054', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.5 FLETES Y GTOS TRANSPORTE INTERNACIONAL ---
  {
    id: 'fletes_internacional',
    numeral: '9.5',
    nombre: 'Fletes y Gastos de Transporte Internacional (Entre Venezuela y el Exterior o viceversa)',
    nombreCorto: 'Fletes Internacionales (9.5)',
    categoria: 'Transporte',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '072', base: 100, porcentaje: 3.00, sustraendoFactor: 0 },
      PNR: { codigo: '071', base: 100, porcentaje: 1.00, sustraendoFactor: 1.00, aplicaMinimo: true },
      PJND: { codigo: '031', base: 5, porcentaje: 5.00, sustraendoFactor: 0, nota: 'Tarifa Nº 2' },
      PNNR: { codigo: '030', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.5 FLETES EN EL PAIS A EMP. INTERNACIONALES ---
  {
    id: 'fletes_emp_internacional',
    numeral: '9.5',
    nombre: 'Fletes en el País a Empresas Internacionales Art. 36 LISLR',
    nombreCorto: 'Fletes a Emp. Internac. (9.5)',
    categoria: 'Transporte',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '072', base: 100, porcentaje: 3.00, sustraendoFactor: 0 },
      PNR: { codigo: '071', base: 100, porcentaje: 1.00, sustraendoFactor: 1.00, aplicaMinimo: true },
      PJND: { codigo: '031', base: 10, porcentaje: 5.00, sustraendoFactor: 0, nota: 'Tarifa Nº 2' },
      PNNR: { codigo: '030', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.6 EXHIBICION DE PELICULAS ---
  {
    id: 'exhibicion_peliculas',
    numeral: '9.6',
    nombre: 'Exhibición de Películas Art. 27 # 15 y 34 LISLR',
    nombreCorto: 'Películas (9.6)',
    categoria: 'Medios',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '055', base: 100, porcentaje: 2.00, sustraendoFactor: 0 },
      PNR: { codigo: '053', base: 100, porcentaje: 1.00, sustraendoFactor: 1.00, aplicaMinimo: true },
      PJND: { codigo: '033', base: 25, porcentaje: 5.00, sustraendoFactor: 0, nota: 'Tarifa Nº 2' },
      PNNR: { codigo: '032', base: 25, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.7 REGALIAS ---
  {
    id: 'regalias',
    numeral: '9.7',
    nombre: 'Regalías Art. 27 # 16 LISLR',
    nombreCorto: 'Regalías (9.7)',
    categoria: 'Propiedad Intelectual',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '055', base: 100, porcentaje: 2.00, sustraendoFactor: 0 },
      PNR: { codigo: '053', base: 100, porcentaje: 1.00, sustraendoFactor: 1.00, aplicaMinimo: true },
      PJND: { codigo: '035', base: 90, porcentaje: 5.00, sustraendoFactor: 0, nota: 'Tarifa Nº 2' },
      PNNR: { codigo: '034', base: 90, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.7 ASISTENCIA TECNICA ---
  {
    id: 'asistencia_tecnica',
    numeral: '9.7',
    nombre: 'Asistencia Técnica Art. 27 # 16 LISLR',
    nombreCorto: 'Asistencia Técnica (9.7)',
    categoria: 'Servicios',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '055', base: 100, porcentaje: 2.00, sustraendoFactor: 0 },
      PNR: { codigo: '053', base: 100, porcentaje: 1.00, sustraendoFactor: 1.00, aplicaMinimo: true },
      PJND: { codigo: '037', base: 30, porcentaje: 5.00, sustraendoFactor: 0, nota: 'Tarifa Nº 2' },
      PNNR: { codigo: '036', base: 30, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.7 SERVICIOS TECNOLOGICOS ---
  {
    id: 'servicios_tecnologicos',
    numeral: '9.7',
    nombre: 'Servicios Tecnológicos Art. 27 # 16 LISLR (Software, Licencias, Nube)',
    nombreCorto: 'Servicios Tecnológicos (9.7)',
    categoria: 'Tecnología',
    frecuente: true,
    tarifas: {
      PJD: { codigo: '055', base: 100, porcentaje: 2.00, sustraendoFactor: 0 },
      PNR: { codigo: '053', base: 100, porcentaje: 1.00, sustraendoFactor: 1.00, aplicaMinimo: true },
      PJND: { codigo: '039', base: 50, porcentaje: 5.00, sustraendoFactor: 0, nota: 'Tarifa Nº 2' },
      PNNR: { codigo: '038', base: 50, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.8 PRIMAS DE SEGURO Y REASEGUROS ---
  {
    id: 'primas_seguros',
    numeral: '9.8',
    nombre: 'Primas de Seguro y Reaseguro Art. 27 # 18 y Parágrafo 3º Art. 52 LISLR',
    nombreCorto: 'Seguros y Reaseguros (9.8)',
    categoria: 'Seguros',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '055', base: 100, porcentaje: 2.00, sustraendoFactor: 0 },
      PNR: { codigo: '053', base: 100, porcentaje: 1.00, sustraendoFactor: 1.00, aplicaMinimo: true },
      PJND: { codigo: '040', base: 30, porcentaje: 10.00, sustraendoFactor: 0, nota: '30% Ingreso Neto' },
      PNNR: { codigo: '054', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.9 GANANCIAS EN JUEGOS Y APUESTAS ---
  {
    id: 'juegos_apuestas',
    numeral: '9.9',
    nombre: 'Ganancias en Juegos y Apuestas',
    nombreCorto: 'Juegos y Apuestas (9.9)',
    categoria: 'Premios',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '043', base: 100, porcentaje: 34.00, sustraendoFactor: 0 },
      PNR: { codigo: '041', base: 100, porcentaje: 34.00, sustraendoFactor: 0 },
      PJND: { codigo: '044', base: 100, porcentaje: 34.00, sustraendoFactor: 0 },
      PNNR: { codigo: '042', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.9 PREMIOS LOTERIA E HIPODROMOS ---
  {
    id: 'premios_loteria',
    numeral: '9.9',
    nombre: 'Premios de Lotería e Hipódromos Art. 62 LISLR',
    nombreCorto: 'Premios Lotería (9.9)',
    categoria: 'Premios',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '047', base: 100, porcentaje: 16.00, sustraendoFactor: 0 },
      PNR: { codigo: '045', base: 100, porcentaje: 16.00, sustraendoFactor: 0 },
      PJND: { codigo: '048', base: 100, porcentaje: 16.00, sustraendoFactor: 0 },
      PNNR: { codigo: '046', base: 100, porcentaje: 16.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.10 PROPIETARIOS ANIMALES DE CARRERAS ---
  {
    id: 'animales_carreras',
    numeral: '9.10',
    nombre: 'Propietarios de Animales de Carreras por Premios Recibidos',
    nombreCorto: 'Animales de Carreras (9.10)',
    categoria: 'Premios',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '051', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '049', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true },
      PJND: { codigo: '052', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '050', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.14 PAGOS DE TARJETAS DE CREDITO O CONSUMO ---
  {
    id: 'tarjetas_credito',
    numeral: '9.14',
    nombre: 'Pagos de Tarjetas de Crédito o Consumo',
    nombreCorto: 'Tarjetas de Crédito (9.14)',
    categoria: 'Bancario',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '067', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '065', base: 100, porcentaje: 3.00, sustraendoFactor: 0 },
      PJND: { codigo: '068', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '066', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.14 PAGO DE GASOLINA CON TARJETA DE CREDITO O CONSUMO ---
  {
    id: 'gasolina_tarjeta',
    numeral: '9.14',
    nombre: 'Pago de Gasolina con Tarjeta de Crédito o Consumo',
    nombreCorto: 'Gasolina con Tarjeta (9.14)',
    categoria: 'Combustible',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '070', base: 100, porcentaje: 1.00, sustraendoFactor: 0 },
      PNR: { codigo: '069', base: 100, porcentaje: 1.00, sustraendoFactor: 0 },
      PJND: { codigo: '070', base: 100, porcentaje: 1.00, sustraendoFactor: 0 },
      PNNR: { codigo: '069', base: 100, porcentaje: 1.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.16 SEGURO A CORREDORES ---
  {
    id: 'seguro_corredores',
    numeral: '9.16',
    nombre: 'Pago de Empresas de Seguros a Corredores',
    nombreCorto: 'Seguro a Corredores (9.16)',
    categoria: 'Seguros',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '074', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '073', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true },
      PJND: { codigo: '074', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '073', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.17 SEGUROS POR REPARACION DE BIENES ---
  {
    id: 'seguros_reparacion_bienes',
    numeral: '9.17',
    nombre: 'Pago de Empresas de Seguros por Reparación de Bienes de sus Asegurados',
    nombreCorto: 'Reparación Seguros (9.17)',
    categoria: 'Seguros',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '076', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '075', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true },
      PJND: { codigo: '076', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '075', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.17 SEGUROS A CENTROS DE SALUD ---
  {
    id: 'seguros_centros_salud',
    numeral: '9.17',
    nombre: 'Pagos de Empresas de Seguros a Centros de Salud por Atención de sus Asegurados',
    nombreCorto: 'Seguros Centros Salud (9.17)',
    categoria: 'Seguros',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '077', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '077', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true },
      PJND: { codigo: '077', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '077', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.18 ADQUISICIÓN DE FONDOS DE COMERCIO ---
  {
    id: 'fondos_comercio',
    numeral: '9.18',
    nombre: 'Pagos por Adquisición de Fondos de Comercio',
    nombreCorto: 'Fondos de Comercio (9.18)',
    categoria: 'Comercial',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '081', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '079', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true },
      PJND: { codigo: '082', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '080', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.20 ACCIONES EN BOLSA ---
  {
    id: 'acciones_bolsa',
    numeral: '9.20',
    nombre: 'Enriquecimientos por Enajenación de Acciones en la Bolsa de Valores',
    nombreCorto: 'Acciones en Bolsa (9.20)',
    categoria: 'Valores',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '087', base: 100, porcentaje: 1.00, sustraendoFactor: 0 },
      PNR: { codigo: '087', base: 100, porcentaje: 1.00, sustraendoFactor: 0 },
      PJND: { codigo: '087', base: 100, porcentaje: 1.00, sustraendoFactor: 0 },
      PNNR: { codigo: '087', base: 100, porcentaje: 1.00, sustraendoFactor: 0 }
    }
  },

  // --- 9.21 ACCIONES FUERA DE BOLSA ---
  {
    id: 'acciones_fuera_bolsa',
    numeral: '9.21',
    nombre: 'Pagos por Enajenación de Acciones Fuera de la Bolsa de Valores',
    nombreCorto: 'Acciones Fuera de Bolsa (9.21)',
    categoria: 'Valores',
    frecuente: false,
    tarifas: {
      PJD: { codigo: '088', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNR: { codigo: '088', base: 100, porcentaje: 3.00, sustraendoFactor: 3.00, aplicaMinimo: true },
      PJND: { codigo: '088', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '088', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  },

  // --- ADQUISICIÓN DE BIENES MUEBLES (NO RETIENE ISLR) ---
  {
    id: 'compra_bienes',
    numeral: 'N/A',
    nombre: 'Adquisición / Compra de Bienes Muebles y Suministros (Exento de Retención ISLR)',
    nombreCorto: 'Bienes / Materiales (0%)',
    categoria: 'Bienes',
    frecuente: true,
    tarifas: {
      PJD: { codigo: '000', base: 100, porcentaje: 0.00, sustraendoFactor: 0 },
      PNR: { codigo: '000', base: 100, porcentaje: 0.00, sustraendoFactor: 0 },
      PJND: { codigo: '000', base: 100, porcentaje: 0.00, sustraendoFactor: 0 },
      PNNR: { codigo: '000', base: 100, porcentaje: 0.00, sustraendoFactor: 0 }
    }
  },

  // --- NO APLICA RETENCIÓN ---
  {
    id: 'no_aplica',
    numeral: 'N/A',
    nombre: 'No Aplica Retención de I.S.L.R. (0.00%)',
    nombreCorto: 'Sin Retención ISLR (0%)',
    categoria: 'Exento',
    frecuente: true,
    tarifas: {
      PJD: { codigo: '000', base: 100, porcentaje: 0.00, sustraendoFactor: 0 },
      PNR: { codigo: '000', base: 100, porcentaje: 0.00, sustraendoFactor: 0 },
      PJND: { codigo: '000', base: 100, porcentaje: 0.00, sustraendoFactor: 0 },
      PNNR: { codigo: '000', base: 100, porcentaje: 0.00, sustraendoFactor: 0 }
    }
  },

  // --- PERSONALIZADO ---
  {
    id: 'personalizado',
    numeral: 'CUSTOM',
    nombre: 'Tarifa o Concepto Personalizado / Variable',
    nombreCorto: 'Personalizado',
    categoria: 'Personalizado',
    frecuente: true,
    tarifas: {
      PJD: { codigo: '999', base: 100, porcentaje: 2.00, sustraendoFactor: 0 },
      PNR: { codigo: '999', base: 100, porcentaje: 1.00, sustraendoFactor: 0 },
      PJND: { codigo: '999', base: 100, porcentaje: 5.00, sustraendoFactor: 0 },
      PNNR: { codigo: '999', base: 100, porcentaje: 34.00, sustraendoFactor: 0 }
    }
  }
];

/**
 * Detecta automáticamente el tipo de persona según el RIF del proveedor
 */
export const detectarTipoPersonaPorRif = (rif = '') => {
  if (!rif || typeof rif !== 'string') return 'PJD';
  const clean = rif.trim().toUpperCase();
  if (clean.startsWith('V') || clean.startsWith('E')) {
    return 'PNR'; // Persona Natural Residente
  }
  if (clean.startsWith('J') || clean.startsWith('G')) {
    return 'PJD'; // Persona Jurídica Domiciliada
  }
  return 'PJD';
};

/**
 * Función financiera estricta que calcula la retención de ISLR según el tabulador y el tipo de sujeto
 */
export const calcularRetencionIslrConTabulador = ({
  baseImponible = 0,
  valorTasa = 1.0000,
  tipoPersona = 'PJD',
  conceptoId = 'servicios_general',
  unidadTributaria = VALOR_UT_DEFAULT,
  porcentajePersonalizado = null,
  basePersonalizada = null
}) => {
  const base = Math.max(0, Number(baseImponible) || 0);
  const tasa = Math.max(0.0001, Number(valorTasa) || 1.0000);
  const ut = Math.max(0.01, Number(unidadTributaria) || VALOR_UT_DEFAULT);

  // Buscar concepto en el catálogo
  const conceptoObj = CONCEPTOS_RETENCION_ISLR.find(c => c.id === conceptoId) ||
                      CONCEPTOS_RETENCION_ISLR.find(c => c.id === 'servicios_general');

  const tarifaInfo = conceptoObj.tarifas[tipoPersona] || conceptoObj.tarifas['PJD'];

  let pctBase = tarifaInfo.base ?? 100;
  if (conceptoId === 'personalizado' && basePersonalizada !== null) {
    pctBase = Number(basePersonalizada) || 100;
  }

  let pctTarifa = tarifaInfo.porcentaje ?? 2.00;
  if (conceptoId === 'personalizado' && porcentajePersonalizado !== null) {
    pctTarifa = Number(porcentajePersonalizado) || 0.00;
  }

  // Base Imponible en Bolívares
  const baseImponibleBs = Math.round((base * tasa) * 100) / 100;
  const baseCalculoBs = Math.round((baseImponibleBs * (pctBase / 100)) * 100) / 100;

  // Monto límite de pago para sustraendo en PNR (83.3334 * UT)
  const montoMinimoBs = calcularMontoMinimoSustraendoBs(ut);

  let sustraendoBs = 0.00;
  let montoRetencionBs = 0.00;
  let aplicaMinimoSinRetencion = false;

  if (pctTarifa <= 0) {
    montoRetencionBs = 0.00;
    sustraendoBs = 0.00;
  } else if (tipoPersona === 'PNR' && tarifaInfo.aplicaMinimo) {
    // Para PNR, si el pago acumulado/factura es menor a 83.3334 UT, no retiene
    if (baseImponibleBs < montoMinimoBs) {
      montoRetencionBs = 0.00;
      sustraendoBs = 0.00;
      aplicaMinimoSinRetencion = true;
    } else {
      // Sustraendo oficial: (Factor * UT * Porcentaje / 100)
      sustraendoBs = Math.round((montoMinimoBs * (pctTarifa / 100)) * 100) / 100;
      const brutoRetBs = baseCalculoBs * (pctTarifa / 100);
      montoRetencionBs = Math.max(0, Math.round((brutoRetBs - sustraendoBs) * 100) / 100);
    }
  } else {
    // Para PJD y otros sujetos sin sustraendo
    montoRetencionBs = Math.round((baseCalculoBs * (pctTarifa / 100)) * 100) / 100;
  }

  // Contravalor de retención en divisas (USD / Divisa base)
  const montoRetencionDivisa = Math.round((montoRetencionBs / tasa) * 100) / 100;
  const sustraendoDivisa = Math.round((sustraendoBs / tasa) * 100) / 100;

  // Porcentaje efectivo real retenido
  const porcentajeEfectivo = base > 0 ? Math.round(((montoRetencionDivisa / base) * 100) * 100) / 100 : pctTarifa;

  return {
    conceptoId: conceptoObj.id,
    numeral: conceptoObj.numeral,
    codigoSeniat: tarifaInfo.codigo || '000',
    conceptoNombre: conceptoObj.nombre,
    conceptoNombreCorto: conceptoObj.nombreCorto,
    tipoPersona,
    unidadTributaria: ut,
    montoMinimoBs,
    porcentajeBase: pctBase,
    porcentajeTarifa: pctTarifa,
    porcentajeEfectivo,
    sustraendoBs,
    sustraendoDivisa,
    aplicaMinimoSinRetencion,
    montoRetencionBs,
    montoRetencionDivisa
  };
};
