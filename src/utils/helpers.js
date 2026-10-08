import { format, getWeek, startOfWeek, endOfWeek } from 'date-fns';

/**
 * Obtiene el número de semana de una fecha.
 */
export const getWeekNumber = (date) => {
  if (!date) return 0;
  return getWeek(new Date(date + 'T12:00:00'), { weekStartsOn: 1 });
};

/**
 * Obtiene el rango de fechas (Inicio - Fin) de una semana específica.
 */
export const getWeekRange = (weekNum, year) => {
  const jan4 = new Date(year, 0, 4);
  const day = jan4.getDay() || 7;
  const start = new Date(jan4);
  start.setDate(jan4.getDate() - (day - 1) + (weekNum - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}`;
};

/**
 * Obtiene objeto de información detallada de semana (número, rango, etiqueta).
 */
export const getSemanaInfo = (dateInput) => {
  if (!dateInput) return null;
  try {
    let d;
    if (dateInput instanceof Date) {
      d = dateInput;
    } else if (typeof dateInput === 'string' && dateInput.includes('T')) {
      d = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
      d = new Date(dateInput + 'T12:00:00');
    } else {
      d = new Date(dateInput);
    }

    if (isNaN(d.getTime())) return null;

    const weekNum = getWeek(d, { weekStartsOn: 1 });
    const year = d.getFullYear();
    const start = startOfWeek(d, { weekStartsOn: 1 });
    const end = endOfWeek(d, { weekStartsOn: 1 });
    const startStr = format(start, 'dd/MM');
    const endStr = format(end, 'dd/MM');

    return {
      weekNum,
      year,
      label: `SEM ${weekNum}`,
      rango: `${startStr} al ${endStr}`,
      fullLabel: `SEM ${weekNum} (${startStr} al ${endStr})`,
      key: `SEM-${weekNum}-${year}`
    };
  } catch (err) {
    console.error("Error al calcular getSemanaInfo:", err);
    return null;
  }
};

/**
 * Obtiene objeto de información de semana dado un número de semana y año.
 */
export const getSemanaInfoForWeek = (weekNum, year) => {
  try {
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setDate(jan4.getDate() - (dayOfWeek - 1));
    
    const start = new Date(mondayWeek1);
    start.setDate(mondayWeek1.getDate() + (weekNum - 1) * 7);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startStr = format(start, 'dd/MM');
    const endStr = format(end, 'dd/MM');

    return {
      weekNum,
      year,
      label: `SEM ${weekNum}`,
      rango: `${startStr} al ${endStr}`,
      fullLabel: `SEM ${weekNum} (${startStr} al ${endStr})`,
      key: `SEM-${weekNum}-${year}`
    };
  } catch (err) {
    console.error("Error en getSemanaInfoForWeek:", err);
    return null;
  }
};

/**
 * Formatea un número como moneda ($).
 */
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value || 0);
};

/**
 * Obtiene las iniciales de un nombre y apellido.
 */
export const getInitials = (nombre, apellido) => {
  const n = (nombre || '').charAt(0);
  const a = (apellido || '').charAt(0);
  return (n + a).toUpperCase() || 'TC';
};

/**
 * Mapeo de gerencias a sus siglas oficiales.
 */
export const obtenerSiglasGerencia = (gerencia) => {
  const gUpper = (gerencia || '').toUpperCase().trim();
  if (gUpper.includes('ADMINISTRA')) {
    return 'ADM';
  }
  const mapping = {
    'Dirección Corporativa': 'DC',
    'Gerencia General': 'GG',
    'Administración': 'ADM',
    'Contabilidad': 'CONT',
    'SIAHO': 'SIAHO',
    'Seguridad': 'SEG',
    'Operaciones': 'OPE',
    'Mantenimiento': 'MANT',
    'Compras': 'COM',
    'Recursos Humanos': 'RRHH',
    'Logística': 'LOG'
  };
  return mapping[gerencia] || 'GEN';
};

/**
 * Resuelve la categoría real de un gasto (ticket o ítem de compra)
 * evitando categorizaciones genéricas como "Ticket", "Tickets", "Directo", etc.
 */
export const resolverCategoriaGasto = (item = {}, doc = {}) => {
  const genericValues = new Set([
    'ticket', 'tickets', 'solicitud de ticket', 'solicitud ticket',
    'ticket express', 'ticket de pago', 'tickets de pago',
    'directo', 'directos', 'gastos imprevistos', 'imprevistos', 'imprevisto',
    's/c', 'n/a', 'sin categoria', 'sin categoría', 'compra', 'otro', 'otros',
    'general', 'null', 'undefined', ''
  ]);

  const esValida = (val) => {
    if (!val || typeof val !== 'string') return false;
    const clean = val.trim().toLowerCase();
    return clean.length > 1 && !genericValues.has(clean);
  };

  // 1. Revisar categorías explícitas en ítem o documento
  const candidatos = [
    item.categoria,
    item.cat,
    item.subcategoria,
    item.clasificacion,
    item.rubro,
    doc.categoria,
    doc.subcategoria,
    doc.clasificacion,
    doc.rubro,
    doc.clasificacion_admin
  ];

  for (const c of candidatos) {
    if (esValida(c)) {
      return c.trim();
    }
  }

  // 2. Si no hay categoría explícita válida, inferir semánticamente por la descripción
  const desc = `${item.descripcion || item.desc || ''} ${doc.descripcion || doc.justificacion || doc.concepto || ''}`.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (desc.includes('GASOLINA') || desc.includes('GSOLINA') || desc.includes('GASOIL') || desc.includes('COMBUSTIBLE') || desc.includes('DIESEL') || desc.includes('LUBRICANTE') || desc.includes('ACEITE DE MOTOR') || desc.includes('ACEITE HIDRAULICO') || desc.includes('REFRIGERANTE') || desc.includes('GRASA')) {
    return 'Combustible y Lubricantes';
  }

  if (desc.includes('AGUA') || desc.includes('HIELO') || desc.includes('VASO') || desc.includes('BOTELLON')) {
    return 'Sucursal Agua, Hielo, Vasos';
  }

  if (desc.includes('SILICONE') || desc.includes('HAMMER') || desc.includes('TEFLON') || desc.includes('TIRRO') || desc.includes('LIJA') || desc.includes('PEGA') || desc.includes('DISCO') || desc.includes('ELECTRODO') || desc.includes('TORNILLO') || desc.includes('TUERCA') || desc.includes('ABRAZADERA') || desc.includes('CONSUMIBLE')) {
    return 'Consumibles De Mantenimiento';
  }

  if (desc.includes('NOMINA') || desc.includes('SALARIO') || desc.includes('BONO') || desc.includes('BONIFICACION') || desc.includes('SUELDO') || desc.includes('QUINCENA') || desc.includes('PAGO CHOFER') || desc.includes('PAGO MECANICO') || desc.includes('AYUDANTE') || desc.includes('PERSONAL')) {
    if (desc.includes('INDIRECTO') || desc.includes('INDIRECTA')) return 'Nóminas y Salarios Indirecto';
    if (desc.includes('DIRECTO') || desc.includes('DIRECTA') || desc.includes('BONIFICACION') || desc.includes('BONO')) return 'Nóminas y Salarios P. Directo';
    return 'Nóminas y Salarios';
  }

  if (desc.includes('PRESTAMO') || desc.includes('ANTICIPO') || desc.includes('ADELANTO')) {
    return 'Préstamos Directos';
  }

  if (desc.includes('AYUDA') || desc.includes('BENEFICIARI') || desc.includes('DONACION') || desc.includes('PARROQUIA') || desc.includes('APORTE') || desc.includes('FARMACIA') || desc.includes('MEDIC')) {
    return 'Ayudas Sociales / Beneficios';
  }

  if (desc.includes('SISTEMA') || desc.includes('SOFTWARE') || desc.includes('LICENCIA') || desc.includes('SERVIDOR') || desc.includes('HOSTING') || desc.includes('SISTEMA DE NOMINA') || desc.includes('ANTIVIRUS') || desc.includes('INTERNET') || desc.includes('CANTV') || desc.includes('OUTSOURCING')) {
    return 'Sistemas, Licencias y Outsourcing';
  }

  if (desc.includes('ALMUERZO') || desc.includes('DESAYUNO') || desc.includes('CENA') || desc.includes('COMIDA') || desc.includes('ALIMENTO') || desc.includes('VIATICO') || desc.includes('HOSPEDAJE') || desc.includes('HOTEL')) {
    return 'Alimentación y Viáticos';
  }

  if (desc.includes('FLETE') || desc.includes('TRANSPORTE') || desc.includes('ENVIO') || desc.includes('ENCOMIENDA') || desc.includes('PASAJE') || desc.includes('TAXI') || desc.includes('TRASLADO') || desc.includes('PEAJE')) {
    return 'Fletes y Transporte';
  }

  if (desc.includes('HERRAMIENTA') || desc.includes('TALADRO') || desc.includes('ESMERIL') || desc.includes('LLAVE') || desc.includes('ALICATE') || desc.includes('DESTORNILLADOR')) {
    return 'Herramientas y Equipos Menores';
  }

  if (desc.includes('ALQUILER') || desc.includes('ARRENDAMIENTO') || desc.includes('ELECTRICIDAD') || desc.includes('CORPOELEC') || desc.includes('CONDOMINIO')) {
    return 'Servicios Básicos y Alquileres';
  }

  if (desc.includes('COMISION') || desc.includes('BANCARI') || desc.includes('ITF') || desc.includes('IGTF') || desc.includes('IMPUESTO')) {
    return 'Comisiones y Gastos Bancarios';
  }

  if (desc.includes('PAPEL') || desc.includes('RESMA') || desc.includes('TINTA') || desc.includes('TONER') || desc.includes('BOLIGRAFO') || desc.includes('OFICINA') || desc.includes('CARPETA')) {
    return 'Papelería y Útiles de Oficina';
  }

  if (desc.includes('UNIFORME') || desc.includes('BOTA') || desc.includes('CASCO') || desc.includes('GUANTE') || desc.includes('LENTE') || desc.includes('BRAGA') || desc.includes('CAMISA') || desc.includes('DOTACION') || desc.includes('EPP')) {
    return 'Uniformes y Dotaciones';
  }

  if (desc.includes('CAUCHO') || desc.includes('BATERIA') || desc.includes('AMORTIGUADOR') || desc.includes('FRENO') || desc.includes('TRIPOIDE') || desc.includes('REPUESTO') || desc.includes('CAMION') || desc.includes('VEHICULO')) {
    return 'Repuestos y Mantenimiento Vehicular';
  }

  if (desc.includes('CLORO') || desc.includes('DESINFECTANTE') || desc.includes('JABON') || desc.includes('CERA') || desc.includes('DESENGRASANTE') || desc.includes('COLETO') || desc.includes('MOPA') || desc.includes('ESCOBA') || desc.includes('LIMPIEZA') || desc.includes('ASEO')) {
    return 'Materiales de Limpieza';
  }

  // 3. Fallback inteligente según gerencia / departamento si todo lo demás falla
  const depto = (doc.departamento || doc.gerencia || '').toUpperCase();
  if (depto.includes('RECURSOS HUMANOS') || depto.includes('RRHH')) return 'Gastos de Personal';
  if (depto.includes('OPERACION')) return 'Gastos Operativos';
  if (depto.includes('ADMINISTRA')) return 'Gastos Administrativos';
  if (depto.includes('SERVICIOS GENERALES')) return 'Servicios Generales';
  if (depto.includes('MANTENIMIENTO')) return 'Mantenimiento General';

  return 'Gastos Operativos';
};

/**
 * Extrae de forma robusta el nombre de una columna que no existe en el esquema según el mensaje de error de PostgREST o Postgres.
 */
export const extraerColumnaInexistente = (errMsg) => {
  if (!errMsg || typeof errMsg !== 'string') return null;

  // Pattern 1: PostgREST "Could not find the 'xyz' column of 'table' in the schema cache"
  const m1 = errMsg.match(/Could not find the ['"]([^'"]+)['"] column/i);
  if (m1 && m1[1]) return m1[1];

  // Pattern 2: Postgres "column "xyz" of relation "table" does not exist" or 'column "xyz" does not exist'
  const m2 = errMsg.match(/column ['"]([^'"]+)['"](?: of relation ['"]?[^'"]+['"]?)? does not exist/i);
  if (m2 && m2[1]) return m2[1];

  // Pattern 3: Postgres "column table.xyz does not exist"
  const m3 = errMsg.match(/column \w+\.([a-zA-Z0-9_]+) does not exist/i);
  if (m3 && m3[1]) return m3[1];

  // Pattern 4: Postgres "column xyz does not exist"
  const m4 = errMsg.match(/column ([a-zA-Z0-9_]+) does not exist/i);
  if (m4 && m4[1] && !['of', 'in', 'the', 'from', 'table'].includes(m4[1].toLowerCase())) return m4[1];

  // Pattern 5: General fallback match for 'column "xyz"'
  const m5 = errMsg.match(/column\s+['"]?([a-zA-Z0-9_]+)['"]?/i);
  if (m5 && m5[1] && !['of', 'in', 'the', 'from', 'table'].includes(m5[1].toLowerCase())) return m5[1];

  return null;
};

/**
 * Extrae el nombre de la columna que causó una violación de clave foránea (foreign key)
 */
export const extraerColumnaForeignKey = (errMsg) => {
  if (!errMsg) return null;
  const fullText = typeof errMsg === 'object' ? `${errMsg.message || ''} ${errMsg.details || ''} ${errMsg.hint || ''}` : String(errMsg);

  // Pattern 1: Key (col_name)=(val) is not present in table "xyz"
  const m1 = fullText.match(/Key\s*\(\s*([a-zA-Z0-9_]+)\s*\)\s*=/i);
  if (m1 && m1[1]) return m1[1];

  // Pattern 2: constraint "table_col_name_fkey" (ej. ordenes_compra_proveedor_id_fkey)
  const m2 = fullText.match(/constraint\s*["']?([a-zA-Z0-9_]+)_fkey["']?/i);
  if (m2 && m2[1]) {
    const raw = m2[1];
    const knownSuffixes = [
      'proveedor_id', 'requisicion_id', 'despachar_a_id', 'orden_compra_id', 
      'requisicion_item_id', 'obra_id', 'solicitud_id', 'cliente_id', 
      'item_id', 'usuario_id', 'user_id', 'elaborado_por_id'
    ];
    for (const suffix of knownSuffixes) {
      if (raw.endsWith(suffix) || raw.includes(suffix)) return suffix;
    }
    const parts = raw.split('_');
    if (parts.length >= 2 && parts[parts.length - 1] === 'id') {
      return `${parts[parts.length - 2]}_id`;
    }
  }

  // Pattern 3: Búsqueda de campos estándar de clave foránea en el mensaje completo
  const knownCols = [
    'proveedor_id', 'requisicion_id', 'despachar_a_id', 'orden_compra_id', 
    'requisicion_item_id', 'obra_id', 'solicitud_id', 'cliente_id', 
    'item_id', 'usuario_id', 'user_id', 'elaborado_por_id'
  ];
  for (const c of knownCols) {
    if (fullText.toLowerCase().includes(c)) return c;
  }

  return null;
};

/**
 * Realiza un update en Supabase eliminando automáticamente columnas que no existan en el esquema
 * o que violen check constraints de enumeración/valores permitidos o claves foráneas inexistentes.
 */
export const safeSupabaseUpdate = async (supabase, table, payload, matchField, matchValue) => {
  let currentPayload = { ...payload };
  let resError = null;
  let resData = null;

  for (let i = 0; i < 8; i++) {
    const { data, error } = await supabase
      .from(table)
      .update(currentPayload)
      .eq(matchField, matchValue)
      .select();

    if (!error) {
      return { data, error: null };
    }

    resError = error;
    const missingCol = extraerColumnaInexistente(error.message);
    if (missingCol && currentPayload[missingCol] !== undefined) {
      console.warn(`[safeSupabaseUpdate] Removiendo columna inexistente '${missingCol}' de '${table}'`);
      delete currentPayload[missingCol];
      continue;
    }

    // Manejo de violación de check constraint (ej. estatus_orden_check)
    if (error.message && (error.message.includes('check constraint') || error.message.includes('violates check constraint'))) {
      const colConConstraint = Object.keys(currentPayload).find(k => error.message.toLowerCase().includes(k.toLowerCase()));
      if (colConConstraint && currentPayload[colConConstraint] !== undefined) {
        console.warn(`[safeSupabaseUpdate] Removiendo columna '${colConConstraint}' por violación de check constraint en '${table}'`);
        delete currentPayload[colConConstraint];
        continue;
      }
    }

    // Manejo de violación de foreign key constraint (ej. ordenes_compra_proveedor_id_fkey)
    const isFkViolation = error && (
      error.code === '23503' || 
      (error.message && (
        error.message.includes('foreign key constraint') || 
        error.message.includes('violates foreign key constraint') || 
        error.message.includes('is not present in table')
      )) ||
      (error.details && error.details.includes('is not present in table'))
    );

    if (isFkViolation) {
      const fkCol = extraerColumnaForeignKey(error);
      if (fkCol && currentPayload[fkCol] !== undefined) {
        console.warn(`[safeSupabaseUpdate] Anulando clave foránea inválida '${fkCol}' en tabla '${table}'`);
        currentPayload[fkCol] = null;
        continue;
      }
    }

    break;
  }

  return { data: resData, error: resError };
};

/**
 * Realiza un insert en Supabase eliminando automáticamente columnas que no existan en el esquema
 * o que violen check constraints de enumeración/valores permitidos o claves foráneas inexistentes.
 */
export const safeSupabaseInsert = async (supabase, table, payload) => {
  let currentPayload = Array.isArray(payload) ? payload.map(p => ({ ...p })) : { ...payload };
  let resError = null;

  for (let i = 0; i < 8; i++) {
    const res = await supabase
      .from(table)
      .insert(currentPayload)
      .select();

    if (!res.error) {
      return { data: res.data, error: null };
    }

    resError = res.error;
    const missingCol = extraerColumnaInexistente(res.error.message);
    if (missingCol) {
      if (Array.isArray(currentPayload)) {
        let deleted = false;
        currentPayload.forEach(row => {
          if (row[missingCol] !== undefined) {
            delete row[missingCol];
            deleted = true;
          }
        });
        if (deleted) continue;
      } else if (currentPayload[missingCol] !== undefined) {
        delete currentPayload[missingCol];
        continue;
      }
    }

    // Manejo de check constraint en insert
    if (res.error.message && (res.error.message.includes('check constraint') || res.error.message.includes('violates check constraint'))) {
      const keys = Array.isArray(currentPayload) ? Object.keys(currentPayload[0] || {}) : Object.keys(currentPayload);
      const colConConstraint = keys.find(k => res.error.message.toLowerCase().includes(k.toLowerCase()));
      if (colConConstraint) {
        if (Array.isArray(currentPayload)) {
          currentPayload.forEach(row => delete row[colConConstraint]);
        } else {
          delete currentPayload[colConConstraint];
        }
        continue;
      }
    }

    // Manejo de violación de foreign key constraint en insert
    const isFkViolation = res.error && (
      res.error.code === '23503' || 
      (res.error.message && (
        res.error.message.includes('foreign key constraint') || 
        res.error.message.includes('violates foreign key constraint') || 
        res.error.message.includes('is not present in table')
      )) ||
      (res.error.details && res.error.details.includes('is not present in table'))
    );

    if (isFkViolation) {
      const fkCol = extraerColumnaForeignKey(res.error);
      if (fkCol) {
        console.warn(`[safeSupabaseInsert] Anulando clave foránea inválida '${fkCol}' en tabla '${table}'`);
        if (Array.isArray(currentPayload)) {
          currentPayload.forEach(row => { row[fkCol] = null; });
        } else {
          currentPayload[fkCol] = null;
        }
        continue;
      }
    }

    break;
  }

  return { data: null, error: resError };
};

