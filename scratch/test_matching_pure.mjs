const normalizarNombreEmpresa = (nombre) => {
  if (!nombre) return '';
  let str = nombre
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes/diacríticos
    .replace(/[.,\-_/\\#()&"']/g, ' ') // Quitar signos y puntuación
    .replace(/\s+/g, ' ');          // Espacios únicos

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
  'VENEZUELA', 'TOTAL', 'DROGUERIA', 'FARMACIAS', 'FARMACIA'
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

  const tokensA = cleanA.split(' ').filter(w => w.length >= 3);
  const tokensB = cleanB.split(' ').filter(w => w.length >= 3);

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
      return true;
    }
  }

  return false;
};

const testPairs = [
  ['FARMATODO', 'DROGUERIA FARMATODO, C.A.'],
  ['FARMATODO', 'FARMATODO C.A.'],
  ['FARMATODO', 'FARMATODO, C.A.'],
  ['FARMATODO', 'FARMACIAS FARMATODO C.A.'],
  ['FARMATODO', 'INVERSIONES FARMATODO S.A.'],
  ['EPA', 'FERRETERIA EPA C.A.'],
  ['MAKRO', 'COMERCIALIZADORA MAKRO C.A.'],
  ['FERRETOTAL', 'FERRETOTAL C.A.'],
  ['LOCATEL', 'LOCATEL C.A.'],
  ['POLAR', 'EMPRESAS POLAR C.A.'],
  ['POLAR', 'ALIMENTOS POLAR COMERCIAL C.A.'],
  ['IWECOTECH', 'INVERSIONES IWECOTECH 2020 C.A.'],
  ['3M', '3M MANUFACTURERA VENEZUELA S.A.'],
  ['PROAGRO', 'DISTRIBUIDORA PROAGRO C.A.'],
  ['OXIGENO ZULIA', 'OXIGENO ZULIA C.A.'],
  ['HERVIGAS', 'HERVIGAS DISTRIBUCIONES C.A.']
];

console.log("=== PROBANDO EMPAREJAMIENTOS DE NOMBRES ===");
testPairs.forEach(([a, b]) => {
  const match = sonProveedoresCoincidentes({ razon_social: a }, { razon_social: b });
  console.log(`[${match ? '✓ MATCH' : '✗ FAIL'}] "${a}" <---> "${b}"`);
});
