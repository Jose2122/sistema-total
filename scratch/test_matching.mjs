function normalizarNombreEmpresa(nombre) {
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
}

const testCases = [
  ['FARMATODO', 'DROGUERIA FARMATODO, C.A.'],
  ['FARMATODO', 'FARMATODO C.A.'],
  ['FARMATODO', 'FARMATODO DE VENEZUELA S.A.'],
  ['IWECOTECH', 'INVERSIONES IWECOTECH 2020 C.A.'],
  ['SUINVERCONCA', 'SUMINISTROS E INVERSIONES CONTINENTAL C.A. (SUINVERCONCA)'],
  ['TORNILLOS 2000, C.A', 'TORNILLOS 2000 C.A.'],
  ['RODAMIENTOS RODRIGUEZ, C.A (RODRICA)', 'RODRICA'],
  ['FILTROS Y LUBRICANTES EL PUENTE C.A.', 'LUBRICANTES EL PUENTE']
];

const GENERIC_WORDS = new Set([
  'INVERSIONES', 'DISTRIBUIDORA', 'COMERCIALIZADORA', 'SUMINISTROS', 
  'SERVICIOS', 'IMPORTADORA', 'CORPORACION', 'GRUPO', 'REPUESTOS', 
  'CONSTRUCCIONES', 'FERRETERIA', 'MANTENIMIENTO', 'TECNOLOGIA', 
  'SOLUCIONES', 'CONSULTORES', 'AUTOMOTRIZ', 'TRANSPORTE', 'LOGISTICA', 
  'VENTAS', 'PRODUCTOS', 'INDUSTRIAS', 'INTERNACIONAL', 'NACIONAL', 
  'VENEZUELA', 'TOTAL'
]);

function matches(nameA, nameB) {
  const cleanA = normalizarNombreEmpresa(nameA);
  const cleanB = normalizarNombreEmpresa(nameB);
  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB) return true;

  const tokensA = cleanA.split(' ').filter(w => w.length >= 3);
  const tokensB = cleanB.split(' ').filter(w => w.length >= 3);

  // 1. Si uno contiene al otro completamente
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
    const shorter = cleanA.length < cleanB.length ? cleanA : cleanB;
    // Si la palabra más corta no es puramente una palabra genérica
    const isGeneric = GENERIC_WORDS.has(shorter.trim());
    if (!isGeneric && shorter.length >= 4) {
      return true;
    }
  }

  // 2. Token overlap distintivo
  const distinctiveA = tokensA.filter(w => !GENERIC_WORDS.has(w) && w.length >= 4);
  const distinctiveB = tokensB.filter(w => !GENERIC_WORDS.has(w) && w.length >= 4);

  if (distinctiveA.length > 0 && distinctiveB.length > 0) {
    const shared = distinctiveA.filter(w => distinctiveB.includes(w));
    if (shared.length > 0) {
      // Si comparten al menos una palabra distintiva clave (ej: FARMATODO, IWECOTECH, SUINVERCONCA, RODRICA)
      if (shared.some(w => w.length >= 4 && !GENERIC_WORDS.has(w))) {
        return true;
      }
    }
  }

  return false;
}

console.log("=== PROBANDO COINCIDENCIAS ===");
testCases.forEach(([a, b]) => {
  console.log(`"${a}" vs "${b}" -> MATCH: ${matches(a, b)}`);
});
