import { supabase } from '../supabaseClient';

/**
 * Obtiene la información del usuario actualmente activo en la sesión
 * buscando en el prop provisto, en el localStorage y en la sesión de Supabase Auth
 * para asegurar que NUNCA aparezca "Sistema" como autor de una modificación.
 */
export const obtenerUsuarioActual = (usuarioProp = null) => {
  // 1. Si se pasó usuarioProp con nombre o correo
  if (usuarioProp && typeof usuarioProp === 'object') {
    const nomProp = (usuarioProp.nombre || '').trim();
    const apeProp = (usuarioProp.apellido || '').trim();
    const mailProp = (usuarioProp.correo || usuarioProp.email || '').trim();
    const nombreCompleto = nomProp ? `${nomProp} ${apeProp}`.trim() : (mailProp ? mailProp.split('@')[0] : '');
    
    if (nombreCompleto && nombreCompleto.toLowerCase() !== 'sistema') {
      return {
        id: usuarioProp.id || null,
        nombre: nombreCompleto,
        correo: mailProp || `${nombreCompleto.toLowerCase().replace(/\s+/g, '.')}@totalclean.com`,
        rol: usuarioProp.rol || usuarioProp.cargo || 'Analista'
      };
    }
  }

  // 2. Buscar en claves comunes de localStorage
  const keysToCheck = ['usuario_sesion', 'usuario', 'sitc_user_profile', 'user_profile', 'currentUser'];
  for (const k of keysToCheck) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const u = JSON.parse(raw);
        if (u && typeof u === 'object') {
          const nom = (u.nombre || '').trim();
          const ape = (u.apellido || '').trim();
          const mail = (u.correo || u.email || '').trim();
          const nombreCompleto = nom ? `${nom} ${ape}`.trim() : (mail ? mail.split('@')[0] : '');
          
          if (nombreCompleto && nombreCompleto.toLowerCase() !== 'sistema') {
            return {
              id: u.id || null,
              nombre: nombreCompleto,
              correo: mail || `${nombreCompleto.toLowerCase().replace(/\s+/g, '.')}@totalclean.com`,
              rol: u.rol || u.cargo || 'Analista'
            };
          }
        }
      }
    } catch {
      // continuar
    }
  }

  // 3. Buscar en el token de autenticación de Supabase en localStorage (sb-*-auth-token)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && ((key.startsWith('sb-') && key.endsWith('-auth-token')) || key === 'supabase.auth.token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const userObj = parsed?.user || parsed?.currentSession?.user;
          if (userObj) {
            const meta = userObj.user_metadata || {};
            const email = (userObj.email || '').trim();
            const nomMeta = (meta.full_name || meta.name || meta.nombre || '').trim();
            const apeMeta = (meta.apellido || '').trim();
            const nombreCompleto = nomMeta ? `${nomMeta} ${apeMeta}`.trim() : (email ? email.split('@')[0] : '');

            if (nombreCompleto && nombreCompleto.toLowerCase() !== 'sistema') {
              return {
                id: userObj.id,
                nombre: nombreCompleto,
                correo: email || 'usuario@totalclean.com',
                rol: meta.rol || meta.cargo || 'Analista'
              };
            }
          }
        }
      }
    }
  } catch {
    // continuar
  }

  return {
    id: null,
    nombre: 'Analista de Compras',
    correo: 'compras@totalclean.com',
    rol: 'Analista'
  };
};

/**
 * Normaliza nombres de empresas eliminando acentos, puntuación, caracteres especiales
 * y sufijos legales comerciales (C.A., S.A., S.R.L., F.P., FIRMA PERSONAL, LLC, INC, etc.)
 */
export const normalizarNombreEmpresa = (nombre) => {
  if (!nombre) return '';
  let str = nombre
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes/diacríticos
    .replace(/[.,\-_/\\#()&"']/g, ' ') // Quitar signos y puntuación
    .replace(/\s+/g, ' ');          // Espacios únicos

  // Eliminar siglas y formas jurídicas empresariales comunes
  const legalRegex = /\b(C\s*A|S\s*A|S\s*R\s*L|SRL|C\s*POR\s*A|C\s*P\s*A|SOCIEDAD\s*ANONIMA|COMPANIA\s*ANONIMA|FIRMA\s*PERSONAL|F\s*P|FP|E\s*I\s*R\s*L|EIRL|LLC|INC|INCORPORATED|CORP|CORPORATION|CORPORACION|GMBH|S\s*A\s*S|SAS|L\s*T\s*D\s*A|LTDA|S\s*C|SC|C\s*C)\b/gi;
  str = str.replace(legalRegex, ' ').replace(/\s+/g, ' ').trim();

  return str;
};

/**
 * Extrae componentes esenciales de un RIF para comparaciones robustas
 */
export const extraerCoreRif = (rif) => {
  if (!rif) return { raw: '', nums: '', core: '' };
  const raw = rif.toString().trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  const nums = raw.replace(/[^0-9]/g, '');
  // El núcleo numérico en Venezuela suele tener 8 dígitos principales
  const core = nums.length >= 8 ? nums.substring(0, 8) : nums;
  return { raw, nums, core };
};

const GENERIC_WORDS_SUPPLIERS = new Set([
  'INVERSIONES', 'INVERSION', 'INVESTMENT', 'INVESTMENTS', 'DISTRIBUIDORA', 'DISTRIBUIDOR', 
  'DISTRIBUTOR', 'DISTRIBUTORS', 'COMERCIALIZADORA', 'COMERCIAL', 'COMERCIO', 'COMMERCE',
  'SUMINISTROS', 'SUMINISTRO', 'SUPPLY', 'SUPPLIES', 'SERVICIOS', 'SERVICIO', 'SERVICES', 
  'SERVICE', 'IMPORTADORA', 'IMPORTACION', 'IMPORTACIONES', 'IMPORT', 'IMPORTS',
  'CORPORACION', 'CORP', 'CORPORATION', 'GRUPO', 'GROUP', 'REPUESTOS', 'REPUESTO', 
  'PARTS', 'CONSTRUCCIONES', 'CONSTRUCCION', 'FERRETERIA', 'MANTENIMIENTO', 'MAINTENANCE',
  'TECNOLOGIA', 'TECNOLOGIAS', 'TECHNOLOGY', 'TECHNOLOGIES', 'TECH', 'SOLUCIONES', 
  'SOLUCION', 'SOLUTIONS', 'SOLUTION', 'CONSULTORES', 'CONSULTOR', 'CONSULTING', 
  'CONSULTORIA', 'AUTOMOTRIZ', 'AUTO', 'TRANSPORTE', 'TRANSPORTES', 'LOGISTICA', 
  'LOGISTICS', 'VENTAS', 'VENTA', 'SALES', 'PRODUCTOS', 'PRODUCTO', 'PRODUCTS', 
  'INDUSTRIAS', 'INDUSTRIA', 'INDUSTRY', 'INDUSTRIES', 'INTERNACIONAL', 'INTERNATIONAL', 
  'NACIONAL', 'NATIONAL', 'VENEZUELA', 'TOTAL', 'DROGUERIA', 'DROGUERIAS', 'FARMACIAS', 
  'FARMACIA', 'LABORATORIO', 'LABORATORIOS', 'EMPRESAS', 'EMPRESA', 'ENTERPRISE', 
  'ENTERPRISES', 'CENTRO', 'CENTER', 'CLINICA', 'MATERIALES', 'INSUMOS', 'ELECTRICOS', 
  'ELECTRICO', 'REPARACIONES', 'EQUIPOS', 'EQUIPO', 'ORIENTE', 'OCCIDENTE', 'TECNICA', 
  'INDUSTRIAL', 'INTEGRALES', 'INTEGRAL', 'CAUCHOS', 'CAUCHO', 'GENERALES', 'GENERAL', 
  'AND', 'THE', 'LOS', 'LAS', 'DEL', 'DE', 'LA', 'EL', 'Y', 'EN', 'OF', 'MEGA', 'MULTI', 
  'MAX', 'PLUS', 'EXPRESS', 'SUPER', 'GLOBAL', 'WORLD', 'STORE', 'SHOP', 'SYSTEM', 'SYSTEMS',
  'SISTEMA', 'SISTEMAS', 'RED', 'NETWORK', 'NETWORKS', 'SECURITY', 'SEGURIDAD'
]);

/**
 * Determina si dos proveedores representan a la misma entidad jurídica/comercial
 */
export const sonProveedoresCoincidentes = (provObjOrNameA, provObjOrNameB) => {
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

    // Si una lista distintiva contiene a la otra y cubre todos sus términos
    const shared = distinctiveA.filter(w => distinctiveB.includes(w));
    if (shared.length === distinctiveA.length && shared.length === distinctiveB.length) {
      return true;
    }
  }

  // 4. Coincidencia por Teléfono SOLO si los nombres completos son muy cercanos
  const telA = typeof provObjOrNameA === 'object' ? (provObjOrNameA?.telefono || '').replace(/[^0-9]/g, '') : '';
  const telB = typeof provObjOrNameB === 'object' ? (provObjOrNameB?.telefono || '').replace(/[^0-9]/g, '') : '';
  if (telA.length >= 7 && telB.length >= 7 && telA === telB && cleanA.length >= 4 && cleanB.length >= 4) {
    if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
  }

  return false;
};

export const parseCuentasBancarias = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') return [raw];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }
  return [];
};

export const getStoredSrm = (provId, provRif) => {
  try {
    const key = `prov_srm_${provId || provRif}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    return null;
  }
  return null;
};

export const saveStoredSrm = (provId, provRif, data) => {
  try {
    const key = `prov_srm_${provId || provRif}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
};

/**
 * Normaliza y enriquece un objeto de proveedor garantizando campos consistentes y sin valores "Sistema"
 */
export const normalizarProveedor = (p) => {
  if (!p) return null;
  const localSrm = getStoredSrm(p.id, p.rif) || {};
  const ctas = parseCuentasBancarias(p.cuentas_bancarias || localSrm.cuentas_bancarias);
  const limite = Number(p.monto_limite_credito || p.limite_credito || localSrm.monto_limite_credito || 0);
  const dias = Number(p.dias_credito || p.dias_credito_habituales || localSrm.dias_credito || localSrm.dias_credito_habituales || 0);
  const contacto = (p.persona_contacto || p.contacto_nombre || localSrm.persona_contacto || localSrm.contacto_nombre || '').trim();
  const contactoAdmin = (p.contacto_administrativo || p.persona_contacto_admin || localSrm.contacto_administrativo || '').trim();
  const ciudad = (p.ciudad || p.localizacion || localSrm.ciudad || localSrm.localizacion || 'Maracaibo').trim();
  const direccion = (p.direccion || localSrm.direccion || '').trim();
  const telefono = (p.telefono || localSrm.telefono || '').trim();
  const correo = (p.correo || localSrm.correo || '').trim();
  const observaciones = (p.observaciones_negociacion || localSrm.observaciones_negociacion || '').trim();
  const califPrecio = p.calificacion_precio ?? localSrm.calificacion_precio ?? 5;
  const califCumplimiento = p.calificacion_cumplimiento ?? localSrm.calificacion_cumplimiento ?? 5;
  const esPref = Boolean(p.es_preferencial ?? p.proveedor_preferencial ?? localSrm.es_preferencial ?? localSrm.proveedor_preferencial ?? false);
  const nivelPref = p.nivel_preferencial || localSrm.nivel_preferencial || (esPref ? 'Tier 1 / Oro' : 'Regular');
  const descPactado = Number(p.descuento_pactado_porcentaje ?? localSrm.descuento_pactado_porcentaje ?? 0);
  const diasCredPactados = Number(p.dias_credito_pactados ?? localSrm.dias_credito_pactados ?? dias ?? 0);
  const tiempoEntrega = p.tiempo_entrega_acordado_dias ?? localSrm.tiempo_entrega_acordado_dias ?? null;
  const vigenciaDesde = p.vigencia_acuerdo_desde || localSrm.vigencia_acuerdo_desde || '';
  const vigenciaHasta = p.vigencia_acuerdo_hasta || localSrm.vigencia_acuerdo_hasta || '';
  const condicionesNota = p.condiciones_acuerdo_nota || localSrm.condiciones_acuerdo_nota || '';

  // Limpiar fallbacks "Sistema"
  let creadoPor = p.creado_por || localSrm.creado_por || '';
  if (creadoPor.toLowerCase() === 'sistema') creadoPor = 'compras@totalclean.com';
  let creadoPorNombre = p.creado_por_nombre || localSrm.creado_por_nombre || '';
  if (creadoPorNombre.toLowerCase() === 'sistema') creadoPorNombre = 'Analista Compras';

  let actualizadoPor = p.actualizado_por || localSrm.actualizado_por || '';
  if (actualizadoPor.toLowerCase() === 'sistema') actualizadoPor = 'compras@totalclean.com';
  let actualizadoPorNombre = p.actualizado_por_nombre || localSrm.actualizado_por_nombre || '';
  if (actualizadoPorNombre.toLowerCase() === 'sistema') actualizadoPorNombre = 'Analista Compras';

  // Normalizar categoría
  let catNorm = '';
  if (Array.isArray(p.categoria)) {
    const valid = p.categoria.map(c => String(c).trim()).filter(c => c && c.toUpperCase() !== 'NULL');
    const specific = valid.filter(c => c.toUpperCase() !== 'OTROS');
    catNorm = specific.length > 0 ? specific.join(', ') : (valid.includes('OTROS') ? 'OTROS' : '');
  } else if (typeof p.categoria === 'string') {
    const trimmed = p.categoria.trim();
    if (trimmed && trimmed.toUpperCase() !== 'NULL') {
      catNorm = trimmed;
    }
  } else if (p.categoria) {
    catNorm = String(p.categoria).trim();
  }

  if (!catNorm && localSrm.categoria) {
    if (Array.isArray(localSrm.categoria)) {
      catNorm = localSrm.categoria.filter(Boolean).join(', ');
    } else {
      catNorm = String(localSrm.categoria).trim();
    }
  }

  if (!catNorm || catNorm.toUpperCase() === 'NULL') {
    catNorm = 'OTROS';
  }

  return {
    ...p,
    id: p.id,
    rif: (p.rif || '').trim().toUpperCase(),
    razon_social: (p.razon_social || p.nombre || '').trim(),
    categoria: catNorm,
    monto_limite_credito: limite,
    limite_credito: limite,
    dias_credito: dias,
    dias_credito_habituales: dias,
    condicion_pago_defecto: p.condicion_pago_defecto || (dias > 0 ? 'CREDITO' : 'CONTADO'),
    persona_contacto: contacto,
    contacto_nombre: contacto,
    contacto_administrativo: contactoAdmin,
    ciudad: ciudad,
    localizacion: ciudad,
    direccion: direccion,
    telefono: telefono,
    correo: correo,
    cuentas_bancarias: ctas,
    observaciones_negociacion: observaciones,
    calificacion_precio: califPrecio,
    calificacion_cumplimiento: califCumplimiento,
    es_preferencial: esPref,
    proveedor_preferencial: esPref,
    nivel_preferencial: nivelPref,
    descuento_pactado_porcentaje: descPactado,
    dias_credito_pactados: diasCredPactados,
    tiempo_entrega_acordado_dias: tiempoEntrega,
    vigencia_acuerdo_desde: vigenciaDesde,
    vigencia_acuerdo_hasta: vigenciaHasta,
    condiciones_acuerdo_nota: condicionesNota,
    creado_por: creadoPor || 'compras@totalclean.com',
    creado_por_nombre: creadoPorNombre || 'Analista Compras',
    actualizado_por: actualizadoPor || 'compras@totalclean.com',
    actualizado_por_nombre: actualizadoPorNombre || 'Analista Compras',
    status: p.status !== undefined ? Boolean(p.status) : true
  };
};

/**
 * Combina dos registros de un proveedor sin perder información completada
 */
export const fusionarProveedor = (base = {}, nuevo = {}) => {
  if (!base && !nuevo) return {};
  if (!base) return { ...nuevo };
  if (!nuevo) return { ...base };

  const merged = { ...base, ...nuevo };

  // Priorizar campos de texto no vacíos (la categoría se maneja con lógica inteligente abajo)
  const camposTexto = [
    'rif', 'telefono', 'correo', 'persona_contacto', 'contacto_nombre', 
    'contacto_administrativo', 'direccion', 'ciudad', 'localizacion', 
    'observaciones_negociacion', 'nivel_preferencial', 'condiciones_acuerdo_nota'
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

  // Manejo inteligente de Categoría: las categorías específicas válidas siempre tienen prioridad sobre 'OTROS' o vacío
  const esCatValida = (c) => {
    if (!c) return false;
    const str = (Array.isArray(c) ? c.join(', ') : String(c)).trim().toUpperCase();
    return str && str !== 'OTROS' && str !== 'SIN CATEGORIA' && str !== 'SIN CATEGORÍA' && str !== 'N/A' && str !== 'NULL' && str !== '—';
  };

  const catBase = (Array.isArray(base.categoria) ? base.categoria.join(', ') : (base.categoria || '')).trim();
  const catNuevo = (Array.isArray(nuevo.categoria) ? nuevo.categoria.join(', ') : (nuevo.categoria || '')).trim();

  if (esCatValida(catNuevo)) {
    merged.categoria = catNuevo;
  } else if (esCatValida(catBase)) {
    merged.categoria = catBase;
  } else if (catNuevo && catNuevo.toUpperCase() !== 'NULL') {
    merged.categoria = catNuevo;
  } else if (catBase && catBase.toUpperCase() !== 'NULL') {
    merged.categoria = catBase;
  } else {
    merged.categoria = 'OTROS';
  }

  // Priorizar RIF formateado y completo
  const rifBase = (base.rif || '').trim().toUpperCase();
  const rifNuevo = (nuevo.rif || '').trim().toUpperCase();
  if (rifNuevo && rifNuevo !== 'SIN RIF') {
    merged.rif = rifNuevo;
  } else if (rifBase && rifBase !== 'SIN RIF') {
    merged.rif = rifBase;
  }

  // Priorizar cuentas bancarias
  const ctasBase = parseCuentasBancarias(base.cuentas_bancarias);
  const ctasNuevo = parseCuentasBancarias(nuevo.cuentas_bancarias);
  if (ctasNuevo.length > 0) {
    merged.cuentas_bancarias = ctasNuevo;
  } else if (ctasBase.length > 0) {
    merged.cuentas_bancarias = ctasBase;
  }

  // ID numérico de Supabase tiene prioridad sobre IDs temporales/históricos
  if (base.id && !isNaN(Number(base.id)) && Number(base.id) > 0) {
    merged.id = base.id;
  } else if (nuevo.id && !isNaN(Number(nuevo.id)) && Number(nuevo.id) > 0) {
    merged.id = nuevo.id;
  }

  // Si base o nuevo tienen flags especiales
  if (base.es_preferencial || nuevo.es_preferencial || base.proveedor_preferencial || nuevo.proveedor_preferencial) {
    merged.es_preferencial = true;
    merged.proveedor_preferencial = true;
  }

  // Límites y condiciones de crédito
  if (nuevo.monto_limite_credito !== undefined && Number(nuevo.monto_limite_credito) > 0) {
    merged.monto_limite_credito = Number(nuevo.monto_limite_credito);
    merged.limite_credito = Number(nuevo.monto_limite_credito);
  } else if (base.monto_limite_credito !== undefined && Number(base.monto_limite_credito) > 0) {
    merged.monto_limite_credito = Number(base.monto_limite_credito);
    merged.limite_credito = Number(base.monto_limite_credito);
  }

  if (nuevo.dias_credito !== undefined && Number(nuevo.dias_credito) > 0) {
    merged.dias_credito = Number(nuevo.dias_credito);
    merged.dias_credito_habituales = Number(nuevo.dias_credito);
  } else if (base.dias_credito !== undefined && Number(base.dias_credito) > 0) {
    merged.dias_credito = Number(base.dias_credito);
    merged.dias_credito_habituales = Number(base.dias_credito);
  }

  // Razón social: preferir la versión con mejor detalle
  const nameBase = (base.razon_social || base.nombre || '').trim();
  const nameNuevo = (nuevo.razon_social || nuevo.nombre || '').trim();
  if (nameNuevo) {
    merged.razon_social = nameNuevo;
  } else if (nameBase) {
    merged.razon_social = nameBase;
  }

  // Atribución de autoría: evitar "Sistema"
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

/**
 * Deduplica un arreglo de proveedores fusionando elementos repetidos
 */
export const deduplicarListaProveedores = (lista = []) => {
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

  // Segundo barrido para resolver casos transitivos
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

export const STORAGE_KEY_HISTORIAL_PROVEEDORES = 'historial_modificaciones_proveedores';
export const STORAGE_KEY_PROVEEDORES_ELIMINADOS = 'local_proveedores_eliminados';

/**
 * Detecta y devuelve una lista estructurada de diferencias entre dos versiones de un proveedor
 */
export const detectarCambiosProveedor = (anterior = null, nuevo = {}) => {
  if (!nuevo) return { cambios: [], tipo: 'MODIFICACION_GENERAL', etiqueta: '✏️ Modificación General' };
  
  if (!anterior) {
    const cuentas = parseCuentasBancarias(nuevo.cuentas_bancarias);
    const catStr = Array.isArray(nuevo.categoria) ? nuevo.categoria.join(', ') : (nuevo.categoria || 'OTROS');
    const cambios = [
      { campo: 'Razón Social', antes: '—', despues: nuevo.razon_social || '—' },
      { campo: 'RIF', antes: '—', despues: nuevo.rif || 'Sin RIF', destacado: Boolean(nuevo.rif && nuevo.rif !== 'Sin RIF') },
      { campo: 'Persona Contacto', antes: '—', despues: nuevo.persona_contacto || nuevo.contacto_nombre || 'Sin contacto' },
      { campo: 'Teléfono', antes: '—', despues: nuevo.telefono || 'Sin teléfono' },
      { campo: 'Correo', antes: '—', despues: nuevo.correo || 'Sin correo' },
      { campo: 'Ciudad / Sede', antes: '—', despues: nuevo.ciudad || nuevo.localizacion || 'Maracaibo' },
      { campo: 'Categoría', antes: '—', despues: catStr || 'OTROS' }
    ];

    if (nuevo.direccion && nuevo.direccion.trim()) {
      cambios.push({ campo: 'Dirección', antes: '—', despues: nuevo.direccion.trim() });
    }

    if (cuentas.length > 0) {
      cambios.push({ 
        campo: 'Cuentas Bancarias', 
        antes: '—', 
        despues: `${cuentas.length} cuenta(s) registrada(s)`,
        detalleCuentas: cuentas 
      });
    }

    return {
      tipo: 'REGISTRO_NUEVO',
      etiqueta: '✨ Proveedor Creado',
      cambios
    };
  }

  const cambios = [];
  let esCambioRif = false;
  let esCambioContacto = false;
  let esCambioBanco = false;
  let esCambioSrm = false;

  // Comparar RIF
  const rifAnt = (anterior.rif || '').trim().toUpperCase();
  const rifNue = (nuevo.rif || '').trim().toUpperCase();
  if (rifAnt !== rifNue) {
    cambios.push({
      campo: 'RIF',
      antes: rifAnt || 'Sin RIF',
      despues: rifNue || 'Sin RIF',
      destacado: true
    });
    esCambioRif = true;
  }

  // Comparar Razón Social
  const nomAnt = (anterior.razon_social || anterior.nombre || '').trim();
  const nomNue = (nuevo.razon_social || nuevo.nombre || '').trim();
  if (nomAnt && nomNue && nomAnt !== nomNue) {
    cambios.push({
      campo: 'Razón Social',
      antes: nomAnt,
      despues: nomNue
    });
  }

  // Comparar Persona Contacto
  const contAnt = (anterior.persona_contacto || anterior.contacto_nombre || '').trim();
  const contNue = (nuevo.persona_contacto || nuevo.contacto_nombre || '').trim();
  if (contAnt !== contNue) {
    cambios.push({
      campo: 'Contacto',
      antes: contAnt || 'Sin contacto',
      despues: contNue || 'Sin contacto'
    });
    esCambioContacto = true;
  }

  // Comparar Teléfono
  const telAnt = (anterior.telefono || '').trim();
  const telNue = (nuevo.telefono || '').trim();
  if (telAnt !== telNue) {
    cambios.push({
      campo: 'Teléfono',
      antes: telAnt || 'Sin teléfono',
      despues: telNue || 'Sin teléfono'
    });
    esCambioContacto = true;
  }

  // Comparar Correo
  const mailAnt = (anterior.correo || '').trim();
  const mailNue = (nuevo.correo || '').trim();
  if (mailAnt !== mailNue) {
    cambios.push({
      campo: 'Correo',
      antes: mailAnt || 'Sin correo',
      despues: mailNue || 'Sin correo'
    });
    esCambioContacto = true;
  }

  // Comparar Dirección
  const dirAnt = (anterior.direccion || '').trim();
  const dirNue = (nuevo.direccion || '').trim();
  if (dirAnt !== dirNue) {
    cambios.push({
      campo: 'Dirección',
      antes: dirAnt || 'Sin dirección',
      despues: dirNue || 'Sin dirección'
    });
  }

  // Comparar Ciudad
  const ciuAnt = (anterior.ciudad || anterior.localizacion || '').trim();
  const ciuNue = (nuevo.ciudad || nuevo.localizacion || '').trim();
  if (ciuAnt && ciuNue && ciuAnt !== ciuNue) {
    cambios.push({
      campo: 'Ciudad / Sede',
      antes: ciuAnt,
      despues: ciuNue
    });
  }

  // Comparar Categoría
  const catAnt = (Array.isArray(anterior.categoria) ? anterior.categoria.join(', ') : (anterior.categoria || '')).trim();
  const catNue = (Array.isArray(nuevo.categoria) ? nuevo.categoria.join(', ') : (nuevo.categoria || '')).trim();
  if (catAnt !== catNue) {
    cambios.push({
      campo: 'Categoría',
      antes: catAnt || 'OTROS',
      despues: catNue || 'OTROS'
    });
  }

  // Comparar Cuentas Bancarias
  const ctasAnt = parseCuentasBancarias(anterior.cuentas_bancarias);
  const ctasNue = parseCuentasBancarias(nuevo.cuentas_bancarias);
  if (ctasAnt.length !== ctasNue.length || JSON.stringify(ctasAnt) !== JSON.stringify(ctasNue)) {
    cambios.push({
      campo: 'Cuentas Bancarias',
      antes: `${ctasAnt.length} cuenta(s) registradas`,
      despues: `${ctasNue.length} cuenta(s) registradas`,
      detalleCuentas: ctasNue
    });
    esCambioBanco = true;
  }

  // Comparar Condiciones SRM (Preferencial, Descuento, Crédito)
  const esPrefAnt = Boolean(anterior.es_preferencial || anterior.proveedor_preferencial);
  const esPrefNue = Boolean(nuevo.es_preferencial || nuevo.proveedor_preferencial);
  if (esPrefAnt !== esPrefNue) {
    cambios.push({
      campo: 'Condición Preferencial',
      antes: esPrefAnt ? '★ PREFERENCIAL' : 'REGULAR',
      despues: esPrefNue ? '★ PREFERENCIAL' : 'REGULAR'
    });
    esCambioSrm = true;
  }

  const descAnt = Number(anterior.descuento_pactado_porcentaje || 0);
  const descNue = Number(nuevo.descuento_pactado_porcentaje || 0);
  if (descAnt !== descNue) {
    cambios.push({
      campo: 'Descuento Pactado',
      antes: `${descAnt}%`,
      despues: `${descNue}%`
    });
    esCambioSrm = true;
  }

  const diasAnt = Number(anterior.dias_credito || anterior.dias_credito_pactados || 0);
  const diasNue = Number(nuevo.dias_credito || nuevo.dias_credito_pactados || 0);
  if (diasAnt !== diasNue) {
    cambios.push({
      campo: 'Días de Crédito',
      antes: `${diasAnt} días`,
      despues: `${diasNue} días`
    });
    esCambioSrm = true;
  }

  const limAnt = Number(anterior.monto_limite_credito || anterior.limite_credito || 0);
  const limNue = Number(nuevo.monto_limite_credito || nuevo.limite_credito || 0);
  if (limAnt !== limNue) {
    cambios.push({
      campo: 'Límite de Crédito',
      antes: `$ ${limAnt.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`,
      despues: `$ ${limNue.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`
    });
    esCambioSrm = true;
  }

  // Clasificar tipo general de modificación
  let tipo = 'MODIFICACION_GENERAL';
  let etiqueta = '✏️ Datos Modificados';

  if (esCambioRif) {
    tipo = 'RIF_ACTUALIZADO';
    etiqueta = '🆔 RIF Actualizado';
  } else if (esCambioBanco) {
    tipo = 'CUENTAS_BANCARIAS';
    etiqueta = '🏦 Cuentas Bancarias';
  } else if (esCambioContacto) {
    tipo = 'CONTACTO_ACTUALIZADO';
    etiqueta = '📞 Contacto Actualizado';
  } else if (esCambioSrm) {
    tipo = 'CONVENIO_SRM';
    etiqueta = '⭐ Convenio SRM';
  }

  if (cambios.length === 0) {
    cambios.push({
      campo: 'Actualización General',
      antes: 'Revisión',
      despues: 'Guardado y verificado'
    });
  }

  return { tipo, etiqueta, cambios };
};

/**
 * Registra una entrada en el historial de modificaciones con atribución de usuario real
 */
export const registrarModificacionProveedor = (anterior, nuevo, usuarioActivo, nombreUsuarioActual) => {
  try {
    const userResuelto = obtenerUsuarioActual(usuarioActivo);
    const emailUsuario = userResuelto.correo;
    const nombreUsuario = (nombreUsuarioActual && nombreUsuarioActual.toLowerCase() !== 'sistema')
      ? nombreUsuarioActual
      : userResuelto.nombre;
    
    const diff = detectarCambiosProveedor(anterior, nuevo);
    
    const nuevaEntrada = {
      id: `MOD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      proveedor_id: nuevo.id || anterior?.id || `PROV-${Date.now()}`,
      razon_social: (nuevo.razon_social || anterior?.razon_social || 'Proveedor').trim(),
      rif: (nuevo.rif || anterior?.rif || '').trim().toUpperCase(),
      tipo_cambio: diff.tipo,
      etiqueta: diff.etiqueta,
      cambios: diff.cambios,
      usuario_nombre: nombreUsuario,
      usuario_correo: emailUsuario,
      fecha: new Date().toISOString(),
      proveedor_snapshot: { ...nuevo }
    };

    const historialActual = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORIAL_PROVEEDORES) || '[]');
    // Mantener los últimos 300 eventos para óptimo rendimiento
    const historialActualizado = [nuevaEntrada, ...historialActual].slice(0, 300);
    localStorage.setItem(STORAGE_KEY_HISTORIAL_PROVEEDORES, JSON.stringify(historialActualizado));

    try {
      window.dispatchEvent(new CustomEvent('historial_proveedores_actualizado', { detail: nuevaEntrada }));
    } catch {
      // ignore
    }

    return nuevaEntrada;
  } catch (err) {
    console.warn("Error registrando modificación en historial:", err);
    return null;
  }
};

/**
 * Identificador correlativo del registro maestro central de proveedores en Supabase
 */
export const CORRELATIVO_SYNC_PROVEEDORES = 'SYS-PROVEEDORES-CENTRAL';

/**
 * Consulta el directorio maestro y el historial global sincronizado desde Supabase
 */
export const obtenerDirectorioCentralCloud = async () => {
  try {
    const { data, error } = await supabase
      .from('requisiciones')
      .select('id, correlativo_req, items, updated_at')
      .eq('correlativo_req', CORRELATIVO_SYNC_PROVEEDORES)
      .limit(1);

    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0];
      const items = Array.isArray(row.items) ? row.items : [];
      const masterObj = items[0] || {};
      const proveedores = Array.isArray(masterObj.proveedores) ? masterObj.proveedores : [];
      const historial = Array.isArray(masterObj.historial_modificaciones) ? masterObj.historial_modificaciones : [];
      return {
        id: row.id,
        proveedores,
        historial,
        updated_at: row.updated_at
      };
    }
  } catch (err) {
    console.warn("Error consultando directorio central en la nube:", err);
  }
  return { id: null, proveedores: [], historial: [], updated_at: null };
};

/**
 * Sincroniza en tiempo real un proveedor nuevo o modificado y su registro de auditoría en la nube
 */
export const sincronizarProveedorCloud = async (nuevoProveedor, nuevaModificacion) => {
  try {
    const { id: existingId, proveedores: provsCloud, historial: histCloud } = await obtenerDirectorioCentralCloud();
    
    // 1. Fusionar proveedor en la lista en la nube
    let listaActualizada = [];
    if (nuevoProveedor) {
      let matched = false;
      listaActualizada = provsCloud.map(p => {
        if (sonProveedoresCoincidentes(p, nuevoProveedor)) {
          matched = true;
          const merged = fusionarProveedor(p, nuevoProveedor);
          return {
            ...merged,
            ...nuevoProveedor,
            categoria: nuevoProveedor.categoria || merged.categoria || p.categoria || 'OTROS'
          };
        }
        return p;
      });
      if (!matched) {
        listaActualizada.unshift(nuevoProveedor);
      }
      listaActualizada = deduplicarListaProveedores(listaActualizada);
    } else {
      listaActualizada = provsCloud;
    }

    // 2. Agregar modificación al historial en la nube
    let historialActualizado = [...histCloud];
    if (nuevaModificacion) {
      const idxH = historialActualizado.findIndex(h => h.id === nuevaModificacion.id);
      if (idxH >= 0) {
        historialActualizado[idxH] = { ...historialActualizado[idxH], ...nuevaModificacion };
      } else {
        historialActualizado.unshift(nuevaModificacion);
      }
      historialActualizado = historialActualizado.slice(0, 500);
    }

    const payloadItems = [{
      tipo: 'DIRECTORIO_CENTRAL_PROVEEDORES',
      ultima_actualizacion: new Date().toISOString(),
      proveedores: listaActualizada,
      historial_modificaciones: historialActualizado
    }];

    if (existingId) {
      await supabase
        .from('requisiciones')
        .update({
          items: payloadItems,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingId);
    } else {
      await supabase
        .from('requisiciones')
        .insert([{
          correlativo_req: CORRELATIVO_SYNC_PROVEEDORES,
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
    }
    return true;
  } catch (err) {
    console.warn("Error sincronizando proveedor en la nube:", err);
    return false;
  }
};

/**
 * Elimina un proveedor del registro maestro central en la nube
 */
export const eliminarProveedorCloud = async (idOrProv) => {
  try {
    const targetId = typeof idOrProv === 'object' && idOrProv ? idOrProv.id : idOrProv;
    const targetRif = (typeof idOrProv === 'object' && idOrProv?.rif ? idOrProv.rif : '').trim().toUpperCase();
    const targetNombre = typeof idOrProv === 'object' && idOrProv?.razon_social ? idOrProv.razon_social.trim() : '';
    const targetNormKey = targetNombre ? normalizarNombreEmpresa(targetNombre) : '';

    const { id: existingId, proveedores: provsCloud, historial: histCloud } = await obtenerDirectorioCentralCloud();
    if (!existingId) return false;

    const listaActualizada = provsCloud.filter(p => {
      if (targetId && String(p.id) === String(targetId)) return false;
      if (targetRif && p.rif && p.rif.trim().toUpperCase() === targetRif) return false;
      if (targetNormKey && normalizarNombreEmpresa(p.razon_social) === targetNormKey) return false;
      return true;
    });

    const payloadItems = [{
      tipo: 'DIRECTORIO_CENTRAL_PROVEEDORES',
      ultima_actualizacion: new Date().toISOString(),
      proveedores: listaActualizada,
      historial_modificaciones: histCloud
    }];

    await supabase
      .from('requisiciones')
      .update({
        items: payloadItems,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingId);
    return true;
  } catch (err) {
    console.warn("Error eliminando proveedor en la nube:", err);
    return false;
  }
};

/**
 * Actualiza la lista global de modificaciones en la nube
 */
export const actualizarHistorialCloud = async (nuevoHistorial = []) => {
  try {
    const { id: existingId, proveedores: provsCloud } = await obtenerDirectorioCentralCloud();
    if (!existingId) return false;

    const payloadItems = [{
      tipo: 'DIRECTORIO_CENTRAL_PROVEEDORES',
      ultima_actualizacion: new Date().toISOString(),
      proveedores: provsCloud,
      historial_modificaciones: nuevoHistorial.slice(0, 500)
    }];

    await supabase
      .from('requisiciones')
      .update({
        items: payloadItems,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingId);
    return true;
  } catch (err) {
    console.warn("Error actualizando historial en la nube:", err);
    return false;
  }
};

/**
 * Obtiene el historial completo de modificaciones ordenado por fecha descendente
 * limpiando registros fallidos o con autor "Sistema"
 */
export const obtenerHistorialModificacionesProveedores = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORIAL_PROVEEDORES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Limpiar registros con autor "Sistema"
        const limpiados = parsed.map(item => {
          let uNom = item.usuario_nombre || '';
          let uMail = item.usuario_correo || '';
          if (!uNom || uNom.toLowerCase() === 'sistema') uNom = 'Analista Compras';
          if (!uMail || uMail.toLowerCase() === 'sistema') uMail = 'compras@totalclean.com';
          return {
            ...item,
            usuario_nombre: uNom,
            usuario_correo: uMail
          };
        });
        return limpiados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      }
    }

    // Inicialización automática a partir de proveedores locales si el log está vacío
    const localList = JSON.parse(localStorage.getItem('local_proveedores_registrados') || '[]');
    const sintetizados = [];

    localList.forEach(p => {
      const tieneRif = Boolean(p.rif && p.rif.trim() && p.rif.trim().toUpperCase() !== 'SIN RIF');
      const fechaMod = p.updated_at || p.created_at || new Date().toISOString();
      let autorNom = p.actualizado_por_nombre || p.creado_por_nombre || 'Analista Compras';
      if (autorNom.toLowerCase() === 'sistema') autorNom = 'Analista Compras';
      let autorMail = p.actualizado_por || p.creado_por || 'compras@totalclean.com';
      if (autorMail.toLowerCase() === 'sistema') autorMail = 'compras@totalclean.com';

      sintetizados.push({
        id: `MOD-INIT-${p.id || Date.now()}`,
        proveedor_id: p.id,
        razon_social: p.razon_social,
        rif: p.rif || 'Sin RIF',
        tipo_cambio: tieneRif ? 'RIF_ACTUALIZADO' : 'MODIFICACION_GENERAL',
        etiqueta: tieneRif ? '🆔 RIF Actualizado' : '✏️ Datos de Proveedor',
        cambios: [
          { campo: 'RIF', antes: '—', despues: p.rif || 'Sin RIF', destacado: tieneRif },
          { campo: 'Contacto', antes: '—', despues: p.persona_contacto || 'Sin contacto' },
          { campo: 'Teléfono', antes: '—', despues: p.telefono || 'Sin teléfono' },
          { campo: 'Ciudad', antes: '—', despues: p.ciudad || p.localizacion || 'Maracaibo' }
        ],
        usuario_nombre: autorNom,
        usuario_correo: autorMail,
        fecha: fechaMod,
        proveedor_snapshot: p
      });
    });

    sintetizados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    if (sintetizados.length > 0) {
      localStorage.setItem(STORAGE_KEY_HISTORIAL_PROVEEDORES, JSON.stringify(sintetizados));
    }
    return sintetizados;
  } catch (err) {
    console.warn("Error leyendo historial de modificaciones:", err);
    return [];
  }
};

/**
 * Cache en memoria con TTL de 3 minutos e invalidación reactiva
 */
let _cachedProveedoresList = null;
let _cachedProveedoresTimestamp = 0;
const PROVEEDORES_CACHE_TTL_MS = 3 * 60 * 1000;

export const invalidarCacheProveedores = () => {
  _cachedProveedoresList = null;
  _cachedProveedoresTimestamp = 0;
};

if (typeof window !== 'undefined') {
  window.addEventListener('proveedores_actualizados', invalidarCacheProveedores);
}

/**
 * Obtiene todos los proveedores fusionando todas las fuentes disponibles:
 * 1. Directorio central en la nube (SYS-PROVEEDORES-CENTRAL)
 * 2. Tabla 'proveedores' en Supabase
 * 3. Almacenamiento local persistente
 * 4. Snapshots del historial y proveedores históricos
 * Utiliza deduplicación multi-fase y caché de alto rendimiento.
 */
export const obtenerTodosProveedores = async (options = {}) => {
  const forceRefresh = Boolean(options && options.forceRefresh);
  const now = Date.now();

  // Retorno instantáneo si la caché en memoria sigue vigente
  if (!forceRefresh && _cachedProveedoresList && (now - _cachedProveedoresTimestamp < PROVEEDORES_CACHE_TTL_MS)) {
    return _cachedProveedoresList;
  }

  // 0 y 1. Consultar directorio central cloud y tabla proveedores de Supabase EN PARALELO
  const [cloudRes, supabaseRes] = await Promise.allSettled([
    obtenerDirectorioCentralCloud(),
    supabase.from('proveedores').select('*').order('razon_social', { ascending: true })
  ]);

  let cloudProvs = [];
  if (cloudRes.status === 'fulfilled' && cloudRes.value) {
    const cloudData = cloudRes.value;
    if (Array.isArray(cloudData.proveedores) && cloudData.proveedores.length > 0) {
      cloudProvs = cloudData.proveedores;
    }
    if (Array.isArray(cloudData.historial) && cloudData.historial.length > 0) {
      try {
        const localHist = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORIAL_PROVEEDORES) || '[]');
        const mapH = new Map();
        [...localHist, ...cloudData.historial].forEach(h => {
          if (h && h.id && !mapH.has(h.id)) {
            mapH.set(h.id, h);
          }
        });
        const histMerged = Array.from(mapH.values()).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        localStorage.setItem(STORAGE_KEY_HISTORIAL_PROVEEDORES, JSON.stringify(histMerged));
      } catch {
        // ignore
      }
    }
  }

  let supabaseProvs = [];
  if (supabaseRes.status === 'fulfilled' && supabaseRes.value && !supabaseRes.value.error && Array.isArray(supabaseRes.value.data)) {
    supabaseProvs = supabaseRes.value.data;
  }

  // 2. Almacenamiento local persistente
  let localProvs = [];
  try {
    const stored = localStorage.getItem('local_proveedores_registrados');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        localProvs = deduplicarListaProveedores(parsed);
      }
    }
  } catch (err) {
    console.warn('Error leyendo local_proveedores_registrados:', err);
  }

  // 3. Proveedores históricos (usar caché local previa o solo si las fuentes primarias están vacías)
  let historicosReqs = [];
  try {
    const rawHistCache = localStorage.getItem('local_proveedores_historicos_extraidos');
    if (rawHistCache) {
      const parsedHist = JSON.parse(rawHistCache);
      if (Array.isArray(parsedHist)) {
        historicosReqs = parsedHist;
      }
    }
  } catch {
    // ignore
  }

  // Si no hay proveedores históricos en caché y no tenemos proveedores primarios, escanear bajo demanda
  if (historicosReqs.length === 0 && cloudProvs.length === 0 && supabaseProvs.length === 0 && localProvs.length === 0) {
    try {
      let reqsAll = [];
      let pageReq = 0;
      let keepReq = true;
      while (keepReq) {
        const { data: chunk, error: reqsError } = await supabase
          .from('requisiciones')
          .select('items, correlativo_req, fecha_emision')
          .range(pageReq * 1000, (pageReq + 1) * 1000 - 1);
        
        if (reqsError) break;
        if (chunk && chunk.length > 0) {
          reqsAll = reqsAll.concat(chunk);
          if (chunk.length < 1000) keepReq = false;
          else pageReq++;
        } else {
          keepReq = false;
        }
      }

      const mapaHist = new Map();
      reqsAll.forEach(r => {
        if (r.correlativo_req?.startsWith('SYS-')) return;
        const items = Array.isArray(r.items) ? r.items : [];
        items.forEach(it => {
          const hist = Array.isArray(it.historial_compras) ? it.historial_compras : [];
          hist.forEach(h => {
            if (h.tipo === 'JUSTIFICACION' || h.tipo === 'ANULACION') return;
            const nombreLimpio = (h.proveedor_nombre || '').trim();
            if (nombreLimpio) {
              const key = normalizarNombreEmpresa(nombreLimpio);
              if (key && !mapaHist.has(key)) {
                mapaHist.set(key, {
                  id: h.proveedor_id || `HIST-${key.substring(0, 15)}`,
                  razon_social: nombreLimpio,
                  rif: h.proveedor_rif || '',
                  persona_contacto: h.contacto || '',
                  contacto_nombre: h.contacto || '',
                  telefono: h.telefono || '',
                  correo: h.correo || '',
                  localizacion: h.ciudad || 'Maracaibo',
                  ciudad: h.ciudad || 'Maracaibo',
                  direccion: h.direccion || '',
                  categoria: (h.categoria && h.categoria.toUpperCase() !== 'OTROS') ? h.categoria : '',
                  status: true,
                  es_historico: true
                });
              }
            }
          });
        });
      });
      historicosReqs = deduplicarListaProveedores(Array.from(mapaHist.values()));
      try {
        localStorage.setItem('local_proveedores_historicos_extraidos', JSON.stringify(historicosReqs));
      } catch {
        // ignore
      }
    } catch (err) {
      console.warn('Error en proceso de proveedores históricos:', err);
    }
  }

  // 3.5 Snapshots de proveedores desde el historial de modificaciones
  let historySnapshots = [];
  try {
    const rawHist = localStorage.getItem(STORAGE_KEY_HISTORIAL_PROVEEDORES);
    if (rawHist) {
      const parsedHist = JSON.parse(rawHist);
      if (Array.isArray(parsedHist)) {
        parsedHist.forEach(item => {
          if (item.proveedor_snapshot && typeof item.proveedor_snapshot === 'object') {
            historySnapshots.push(item.proveedor_snapshot);
          }
        });
      }
    }
  } catch (err) {
    console.warn('Error extrayendo snapshots de historial:', err);
  }

  // 3.8 Blacklist / Tombstones de proveedores eliminados
  let eliminadosSet = new Set();
  let eliminadosRifSet = new Set();
  let eliminadosNormSet = new Set();
  try {
    const rawElim = localStorage.getItem(STORAGE_KEY_PROVEEDORES_ELIMINADOS);
    if (rawElim) {
      const parsedElim = JSON.parse(rawElim);
      if (Array.isArray(parsedElim)) {
        parsedElim.forEach(e => {
          if (e.id) eliminadosSet.add(String(e.id));
          if (e.rif && e.rif.toUpperCase() !== 'SIN RIF') eliminadosRifSet.add(e.rif.toUpperCase());
          if (e.normKey) eliminadosNormSet.add(e.normKey);
          if (e.razon_social) eliminadosNormSet.add(normalizarNombreEmpresa(e.razon_social));
        });
      }
    }
  } catch (err) {
    console.warn('Error leyendo proveedores eliminados:', err);
  }

  const esProveedorEliminado = (p) => {
    if (!p) return true;
    if (p.id && eliminadosSet.has(String(p.id))) return true;
    if (p.rif && p.rif.trim() && eliminadosRifSet.has(p.rif.trim().toUpperCase())) return true;
    const norm = normalizarNombreEmpresa(p.razon_social || '');
    if (norm && eliminadosNormSet.has(norm)) return true;
    if (p.razon_social && String(p.razon_social).startsWith('[ELIMINADO]')) return true;
    if (p.status === false && p.eliminado === true) return true;
    return false;
  };

  // 4. Fusionar con precedencia inteligente multi-fuente:
  // 1º Directorio Nube (Cloud) y Registros Editados > 2º Snapshots de Auditoría > 3º Supabase > 4º Históricos de Requisiciones
  const listaBruta = [...cloudProvs, ...localProvs, ...historySnapshots, ...supabaseProvs, ...historicosReqs]
    .filter(p => !esProveedorEliminado(p));
  const listaDeduplicada = deduplicarListaProveedores(listaBruta);

  // Sincronizar permanentemente en almacenamiento local para respaldo offline
  try {
    localStorage.setItem('local_proveedores_registrados', JSON.stringify(listaDeduplicada));
  } catch {
    // ignore
  }

  const todos = listaDeduplicada.map(p => normalizarProveedor(p));
  todos.sort((a, b) => (a.razon_social || '').localeCompare(b.razon_social || '', 'es'));
  
  _cachedProveedoresList = todos;
  _cachedProveedoresTimestamp = Date.now();
  return todos;
};

/**
 * Guarda un proveedor de forma integral y sincronizada:
 * - Detecta diferencias y registra en el historial de modificaciones
 * - Sincroniza con el directorio central en la nube (SYS-PROVEEDORES-CENTRAL)
 * - Guarda en Supabase (si está autenticado/permitido)
 * - Guarda en localStorage (`local_proveedores_registrados`) deduplicado
 * - Guarda metadatos SRM
 * - Dispara eventos globales `proveedores_actualizados` e `historial_proveedores_actualizado`
 */
export const guardarProveedorService = async (formData, usuarioActivo, nombreUsuarioActual) => {
  const rifLimpio = (formData.rif || '').trim().toUpperCase();
  const esEdicion = Boolean(formData.id);
  const idProveedor = formData.id || `PROV-${Date.now()}`;

  const userResuelto = obtenerUsuarioActual(usuarioActivo);
  const emailUsuario = userResuelto.correo;
  const nombreUsuario = (nombreUsuarioActual && nombreUsuarioActual.toLowerCase() !== 'sistema')
    ? nombreUsuarioActual
    : userResuelto.nombre;

  const ciudadVal = (formData.ciudad || formData.localizacion || 'Maracaibo').trim();

  // Obtener estado anterior para el registro de auditoría de cambios
  let proveedorAnterior = null;
  try {
    const localList = JSON.parse(localStorage.getItem('local_proveedores_registrados') || '[]');
    proveedorAnterior = localList.find(p => sonProveedoresCoincidentes(p, formData)) || null;
  } catch {
    // ignore
  }

  const creadorOriginalNom = (formData.creado_por_nombre && formData.creado_por_nombre.toLowerCase() !== 'sistema')
    ? formData.creado_por_nombre
    : (proveedorAnterior?.creado_por_nombre && proveedorAnterior.creado_por_nombre.toLowerCase() !== 'sistema' ? proveedorAnterior.creado_por_nombre : nombreUsuario);

  const creadorOriginalMail = (formData.creado_por && formData.creado_por.toLowerCase() !== 'sistema')
    ? formData.creado_por
    : (proveedorAnterior?.creado_por && proveedorAnterior.creado_por.toLowerCase() !== 'sistema' ? proveedorAnterior.creado_por : emailUsuario);

  // Procesar categorías: limpiar, remover OTROS si hay categorías específicas
  let catsArr = [];
  if (Array.isArray(formData.categoria)) {
    catsArr = formData.categoria.map(c => String(c).trim().toUpperCase()).filter(Boolean);
  } else if (typeof formData.categoria === 'string' && formData.categoria.trim()) {
    catsArr = formData.categoria.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
  }
  if (catsArr.length > 1) {
    catsArr = catsArr.filter(c => c !== 'OTROS');
  }
  const catFinal = catsArr.length > 0 ? catsArr.join(', ') : 'OTROS';

  const payloadCompleto = {
    id: idProveedor,
    rif: rifLimpio,
    razon_social: formData.razon_social.trim(),
    persona_contacto: formData.persona_contacto?.trim() || '',
    contacto_nombre: formData.persona_contacto?.trim() || '',
    contacto_administrativo: formData.contacto_administrativo?.trim() || '',
    ciudad: ciudadVal,
    localizacion: ciudadVal,
    correo: (formData.correo || '').trim(),
    telefono: (formData.telefono || '').trim(),
    direccion: (formData.direccion || '').trim(),
    categoria: catFinal,
    monto_limite_credito: Number(formData.monto_limite_credito) || 0,
    limite_credito: Number(formData.monto_limite_credito) || 0,
    dias_credito: Number(formData.dias_credito) || 0,
    dias_credito_habituales: Number(formData.dias_credito) || 0,
    condicion_pago_defecto: Number(formData.dias_credito) > 0 ? 'CREDITO' : 'CONTADO',
    calificacion_precio: Number(formData.calificacion_precio) || 5,
    calificacion_cumplimiento: Number(formData.calificacion_cumplimiento) || 5,
    observaciones_negociacion: formData.observaciones_negociacion || '',
    es_preferencial: Boolean(formData.es_preferencial || formData.proveedor_preferencial),
    proveedor_preferencial: Boolean(formData.es_preferencial || formData.proveedor_preferencial),
    nivel_preferencial: (formData.es_preferencial || formData.proveedor_preferencial) ? (formData.nivel_preferencial || 'Tier 1 / Oro') : 'Regular',
    descuento_pactado_porcentaje: Number(formData.descuento_pactado_porcentaje) || 0,
    dias_credito_pactados: Number(formData.dias_credito_pactados || formData.dias_credito) || 0,
    tiempo_entrega_acordado_dias: formData.tiempo_entrega_acordado_dias ? Number(formData.tiempo_entrega_acordado_dias) : null,
    vigencia_acuerdo_desde: formData.vigencia_acuerdo_desde || null,
    vigencia_acuerdo_hasta: formData.vigencia_acuerdo_hasta || null,
    condiciones_acuerdo_nota: formData.condiciones_acuerdo_nota || '',
    status: formData.status !== undefined ? formData.status : true,
    cuentas_bancarias: formData.cuentas_bancarias || [],
    creado_por: creadorOriginalMail,
    creado_por_nombre: creadorOriginalNom,
    actualizado_por: emailUsuario,
    actualizado_por_nombre: nombreUsuario,
    created_at: esEdicion ? (formData.created_at || new Date().toISOString()) : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 1. Guardar en almacenamiento local persistente con deduplicación estricta
  try {
    const localList = JSON.parse(localStorage.getItem('local_proveedores_registrados') || '[]');
    let updatedList = [];
    let replaced = false;

    localList.forEach(p => {
      if (sonProveedoresCoincidentes(p, payloadCompleto)) {
        replaced = true;
        updatedList.push({
          ...p,
          ...payloadCompleto,
          categoria: catFinal,
          id: (p.id && !isNaN(Number(p.id)) && Number(p.id) > 0) ? p.id : payloadCompleto.id
        });
      } else {
        updatedList.push(p);
      }
    });

    if (!replaced) {
      updatedList.unshift(payloadCompleto);
    }

    const listaLimpia = deduplicarListaProveedores(updatedList);
    localStorage.setItem('local_proveedores_registrados', JSON.stringify(listaLimpia));
  } catch (e) {
    console.warn("Error guardando en localStorage:", e);
  }

  // 2. Guardar SRM en almacenamiento local
  saveStoredSrm(idProveedor, rifLimpio, {
    monto_limite_credito: Number(formData.monto_limite_credito) || 0,
    limite_credito: Number(formData.monto_limite_credito) || 0,
    dias_credito: Number(formData.dias_credito) || 0,
    dias_credito_habituales: Number(formData.dias_credito) || 0,
    persona_contacto: formData.persona_contacto || '',
    contacto_administrativo: formData.contacto_administrativo || '',
    ciudad: ciudadVal,
    observaciones_negociacion: formData.observaciones_negociacion || '',
    calificacion_precio: Number(formData.calificacion_precio) || 5,
    calificacion_cumplimiento: Number(formData.calificacion_cumplimiento) || 5,
    es_preferencial: payloadCompleto.es_preferencial,
    proveedor_preferencial: payloadCompleto.proveedor_preferencial,
    nivel_preferencial: payloadCompleto.nivel_preferencial,
    descuento_pactado_porcentaje: payloadCompleto.descuento_pactado_porcentaje,
    dias_credito_pactados: payloadCompleto.dias_credito_pactados,
    tiempo_entrega_acordado_dias: payloadCompleto.tiempo_entrega_acordado_dias,
    vigencia_acuerdo_desde: payloadCompleto.vigencia_acuerdo_desde,
    vigencia_acuerdo_hasta: payloadCompleto.vigencia_acuerdo_hasta,
    condiciones_acuerdo_nota: payloadCompleto.condiciones_acuerdo_nota,
    cuentas_bancarias: formData.cuentas_bancarias || [],
    creado_por: payloadCompleto.creado_por,
    creado_por_nombre: payloadCompleto.creado_por_nombre,
    actualizado_por: payloadCompleto.actualizado_por,
    actualizado_por_nombre: payloadCompleto.actualizado_por_nombre,
    categoria: catFinal,
    updated_at: new Date().toISOString()
  });

  // 3. Registrar auditoría de modificaciones
  let nuevaEntradaAuditoria = null;
  try {
    nuevaEntradaAuditoria = registrarModificacionProveedor(proveedorAnterior, payloadCompleto, usuarioActivo, nombreUsuarioActual);
  } catch (errAud) {
    console.warn("Aviso al registrar auditoría:", errAud);
  }

  // 4. Sincronizar inmediatamente con el registro maestro en la nube (SYS-PROVEEDORES-CENTRAL)
  try {
    await sincronizarProveedorCloud(payloadCompleto, nuevaEntradaAuditoria);
  } catch (errSync) {
    console.warn("Aviso sincronizando con directorio central cloud:", errSync);
  }

  // 5. Sincronizar con tabla proveedores de Supabase
  try {
    const dbPayload = {
      rif: rifLimpio,
      razon_social: formData.razon_social.trim(),
      persona_contacto: formData.persona_contacto?.trim() || '',
      ciudad: ciudadVal,
      localizacion: ciudadVal,
      correo: (formData.correo || '').trim(),
      telefono: (formData.telefono || '').trim(),
      direccion: (formData.direccion || '').trim(),
      categoria: catFinal,
      dias_credito_habituales: Number(formData.dias_credito) || 0,
      condicion_pago_defecto: Number(formData.dias_credito) > 0 ? 'CREDITO' : 'CONTADO',
      status: formData.status !== undefined ? formData.status : true,
      cuentas_bancarias: formData.cuentas_bancarias || []
    };

    const esIdNumerico = !isNaN(Number(formData.id)) && Number(formData.id) > 0;
    if (esIdNumerico) {
      const { error: upErr } = await supabase.from('proveedores').update(dbPayload).eq('id', Number(formData.id));
      if (upErr) console.warn("Aviso update Supabase proveedores table:", upErr.message);
    } else {
      const { data: provExistente } = await supabase
        .from('proveedores')
        .select('id')
        .eq('rif', rifLimpio)
        .limit(1);

      if (provExistente && provExistente.length > 0) {
        const realDbId = provExistente[0].id;
        payloadCompleto.id = realDbId;
        await supabase.from('proveedores').update(dbPayload).eq('id', realDbId);
      } else {
        const { data: insData, error: insErr } = await supabase.from('proveedores').insert([dbPayload]).select();
        if (!insErr && insData && insData[0]) {
          payloadCompleto.id = insData[0].id;
          try {
            const list = JSON.parse(localStorage.getItem('local_proveedores_registrados') || '[]');
            const updated = list.map(p => (sonProveedoresCoincidentes(p, payloadCompleto)) ? payloadCompleto : p);
            localStorage.setItem('local_proveedores_registrados', JSON.stringify(deduplicarListaProveedores(updated)));
          } catch {
            // ignore
          }
        }
      }
    }
  } catch (errDb) {
    console.warn("Aviso sincronización tabla proveedores Supabase:", errDb);
  }

  // 6. Notificar a toda la aplicación
  try {
    window.dispatchEvent(new CustomEvent('proveedores_actualizados', { detail: payloadCompleto }));
    window.dispatchEvent(new Event('proveedores_actualizados'));
  } catch {
    // ignore
  }

  return normalizarProveedor(payloadCompleto);
};

export const eliminarProveedorService = async (idOrProv) => {
  const targetId = typeof idOrProv === 'object' && idOrProv ? idOrProv.id : idOrProv;
  const targetRif = (typeof idOrProv === 'object' && idOrProv?.rif ? idOrProv.rif : '').trim().toUpperCase();
  const targetNombre = typeof idOrProv === 'object' && idOrProv?.razon_social ? idOrProv.razon_social.trim() : '';
  const targetNormKey = targetNombre ? normalizarNombreEmpresa(targetNombre) : '';

  // 1. Guardar en Blacklist / Tombstones de proveedores eliminados en localStorage
  try {
    const rawElim = localStorage.getItem(STORAGE_KEY_PROVEEDORES_ELIMINADOS);
    const listaElim = rawElim ? JSON.parse(rawElim) : [];
    const nuevoElim = {
      id: targetId,
      rif: targetRif,
      razon_social: targetNombre,
      normKey: targetNormKey,
      fecha_eliminacion: new Date().toISOString()
    };
    const sinDuplicados = listaElim.filter(e => {
      if (targetId && String(e.id) === String(targetId)) return false;
      if (targetRif && e.rif && e.rif.toUpperCase() === targetRif) return false;
      if (targetNormKey && e.normKey && e.normKey === targetNormKey) return false;
      return true;
    });
    sinDuplicados.push(nuevoElim);
    localStorage.setItem(STORAGE_KEY_PROVEEDORES_ELIMINADOS, JSON.stringify(sinDuplicados));
  } catch (e) {
    console.warn('Error guardando en blacklist local de eliminados:', e);
  }

  // 2. Eliminar de local_proveedores_registrados
  try {
    const localList = JSON.parse(localStorage.getItem('local_proveedores_registrados') || '[]');
    const provEliminado = localList.find(p => {
      if (targetId && String(p.id) === String(targetId)) return true;
      if (targetRif && p.rif && p.rif.trim().toUpperCase() === targetRif) return true;
      if (targetNormKey && normalizarNombreEmpresa(p.razon_social) === targetNormKey) return true;
      return false;
    });
    const updated = localList.filter(p => {
      if (targetId && String(p.id) === String(targetId)) return false;
      if (targetRif && p.rif && p.rif.trim().toUpperCase() === targetRif) return false;
      if (targetNormKey && normalizarNombreEmpresa(p.razon_social) === targetNormKey) return false;
      return true;
    });
    localStorage.setItem('local_proveedores_registrados', JSON.stringify(updated));

    if (provEliminado) {
      registrarModificacionProveedor(
        provEliminado, 
        { ...provEliminado, status: false, razon_social: `[ELIMINADO] ${provEliminado.razon_social}` },
        null,
        'Analista'
      );
    }
  } catch (e) {
    console.warn('Error eliminando de localStorage:', e);
  }

  // 3. Eliminar de SYS-PROVEEDORES-CENTRAL en la nube
  try {
    await eliminarProveedorCloud(idOrProv);
  } catch (errCloudDel) {
    console.warn('Aviso eliminando de cloud:', errCloudDel);
  }

  // 4. Eliminar de Supabase tabla proveedores
  try {
    if (targetId && !isNaN(Number(targetId)) && Number(targetId) > 0) {
      const { error: errDelId } = await supabase.from('proveedores').delete().eq('id', Number(targetId));
      if (errDelId) {
        console.warn('Supabase delete by ID error:', errDelId);
        await supabase.from('proveedores').update({ status: false, activo: false, razon_social: `[ELIMINADO] ${targetNombre || targetId}` }).eq('id', Number(targetId));
      }
    }
    if (targetRif && targetRif !== 'SIN RIF') {
      const { error: errDelRif } = await supabase.from('proveedores').delete().eq('rif', targetRif);
      if (errDelRif) {
        console.warn('Supabase delete by RIF warn:', errDelRif);
      }
    }
  } catch (err) {
    console.warn('Aviso Supabase delete:', err);
  }

  // 5. Notificar a componentes
  try {
    window.dispatchEvent(new CustomEvent('proveedores_actualizados', { detail: { id: targetId, rif: targetRif, deleted: true } }));
    window.dispatchEvent(new Event('proveedores_actualizados'));
  } catch {
    // ignore
  }
};

/**
 * Elimina una entrada individual del historial de modificaciones
 */
export const eliminarEntradaHistorialProveedor = (idEntrada) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORIAL_PROVEEDORES);
    const list = raw ? JSON.parse(raw) : [];
    const updated = list.filter(item => item.id !== idEntrada);
    localStorage.setItem(STORAGE_KEY_HISTORIAL_PROVEEDORES, JSON.stringify(updated));
    
    // Sincronizar eliminación en la nube
    actualizarHistorialCloud(updated);

    try {
      window.dispatchEvent(new CustomEvent('historial_proveedores_actualizado', { detail: { id: idEntrada, deleted: true } }));
      window.dispatchEvent(new Event('historial_proveedores_actualizado'));
    } catch {
      // ignore
    }
    return updated;
  } catch (err) {
    console.warn("Error eliminando entrada del historial:", err);
    return [];
  }
};

/**
 * Limpia y vacía todo el historial de modificaciones de proveedores
 */
export const limpiarHistorialModificacionesProveedores = () => {
  try {
    localStorage.setItem(STORAGE_KEY_HISTORIAL_PROVEEDORES, JSON.stringify([]));
    
    // Sincronizar vaciado en la nube
    actualizarHistorialCloud([]);

    try {
      window.dispatchEvent(new CustomEvent('historial_proveedores_actualizado', { detail: { cleared: true } }));
      window.dispatchEvent(new Event('historial_proveedores_actualizado'));
    } catch {
      // ignore
    }
    return [];
  } catch (err) {
    console.warn("Error vaciando historial de modificaciones:", err);
    return [];
  }
};

/**
 * Actualiza una entrada existente en el historial de modificaciones (para Super Admins)
 */
export const actualizarEntradaHistorialProveedor = (idEntrada, datosEditados = {}) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORIAL_PROVEEDORES);
    const list = raw ? JSON.parse(raw) : [];
    const index = list.findIndex(item => item.id === idEntrada);
    if (index === -1) return list;

    const entradaExistente = list[index];
    const entradaActualizada = {
      ...entradaExistente,
      ...datosEditados,
      id: entradaExistente.id,
      proveedor_id: datosEditados.proveedor_id || entradaExistente.proveedor_id,
      razon_social: datosEditados.razon_social?.trim() || entradaExistente.razon_social,
      rif: (datosEditados.rif !== undefined ? datosEditados.rif : entradaExistente.rif)?.trim().toUpperCase(),
      usuario_nombre: datosEditados.usuario_nombre?.trim() || entradaExistente.usuario_nombre,
      usuario_correo: datosEditados.usuario_correo?.trim() || entradaExistente.usuario_correo,
      fecha: datosEditados.fecha || entradaExistente.fecha,
      etiqueta: datosEditados.etiqueta || entradaExistente.etiqueta,
      tipo_cambio: datosEditados.tipo_cambio || entradaExistente.tipo_cambio,
      nota_admin: datosEditados.nota_admin !== undefined ? datosEditados.nota_admin : (entradaExistente.nota_admin || '')
    };

    list[index] = entradaActualizada;
    localStorage.setItem(STORAGE_KEY_HISTORIAL_PROVEEDORES, JSON.stringify(list));

    // Sincronizar edición en la nube
    actualizarHistorialCloud(list);

    try {
      window.dispatchEvent(new CustomEvent('historial_proveedores_actualizado', { detail: entradaActualizada }));
      window.dispatchEvent(new Event('historial_proveedores_actualizado'));
    } catch {
      // ignore
    }

    return list;
  } catch (err) {
    console.warn("Error actualizando entrada de historial:", err);
    return [];
  }
};

/**
 * Garantiza que un proveedor exista con un ID numérico válido en la tabla 'proveedores' de PostgreSQL
 * para satisfacer restricciones de clave foránea (foreign key constraints) al generar o editar ODCs.
 */
export const asegurarProveedorEnBaseDeDatos = async (provData) => {
  if (!provData) return null;

  // 1. Si ya tiene un ID numérico válido, verificar si existe en la base de datos
  const esNumId = !isNaN(Number(provData.id)) && Number(provData.id) > 0;
  if (esNumId) {
    try {
      const { data: existing } = await supabase
        .from('proveedores')
        .select('id')
        .eq('id', Number(provData.id))
        .maybeSingle();
      if (existing?.id) {
        return Number(existing.id);
      }
    } catch {
      // continuar
    }
  }

  const rifLimpio = (provData.rif || provData.proveedor_rif || '').trim().toUpperCase();
  const razonSocial = (provData.razon_social || provData.nombre || provData.proveedor_nombre || '').trim();

  // 2. Buscar por RIF en Supabase si es válido
  if (rifLimpio && rifLimpio !== 'N/A' && rifLimpio !== 'SIN RIF') {
    try {
      const { data: byRif } = await supabase
        .from('proveedores')
        .select('id')
        .eq('rif', rifLimpio)
        .limit(1);
      if (byRif && byRif.length > 0 && byRif[0].id) {
        return Number(byRif[0].id);
      }
    } catch {
      // continuar
    }
  }

  // 3. Buscar por Razón Social exacta
  if (razonSocial && razonSocial !== 'N/A') {
    try {
      const { data: byName } = await supabase
        .from('proveedores')
        .select('id')
        .ilike('razon_social', razonSocial)
        .limit(1);
      if (byName && byName.length > 0 && byName[0].id) {
        return Number(byName[0].id);
      }
    } catch {
      // continuar
    }
  }

  // 4. Si no existe en la tabla proveedores de Supabase, crearlo automáticamente para generar la clave foránea
  if (razonSocial && razonSocial !== 'N/A') {
    try {
      const dbPayload = {
        razon_social: razonSocial,
        rif: rifLimpio && rifLimpio !== 'N/A' ? rifLimpio : 'SIN RIF',
        persona_contacto: (provData.persona_contacto || provData.contacto_nombre || provData.proveedor_contacto || '').trim(),
        telefono: (provData.telefono || provData.proveedor_telefono || '').trim(),
        correo: (provData.correo || provData.email || '').trim(),
        direccion: (provData.direccion || provData.proveedor_direccion || '').trim(),
        ciudad: (provData.ciudad || provData.localizacion || provData.proveedor_ciudad || 'Maracaibo').trim(),
        categoria: provData.categoria || 'OTROS',
        status: true
      };

      const { data: insData, error: insErr } = await supabase
        .from('proveedores')
        .insert([dbPayload])
        .select('id');

      if (!insErr && insData && insData[0]?.id) {
        const nuevoId = Number(insData[0].id);
        invalidarCacheProveedores();
        try {
          window.dispatchEvent(new CustomEvent('proveedores_actualizados'));
        } catch {
          // ignore
        }
        return nuevoId;
      }
    } catch (e) {
      console.warn("Aviso al auto-registrar proveedor para clave foránea:", e);
    }
  }

  return null;
};




