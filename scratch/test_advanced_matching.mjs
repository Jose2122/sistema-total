import { normalizarNombreEmpresa, sonProveedoresCoincidentes, deduplicarListaProveedores, fusionarProveedor } from '../src/services/proveedoresService.js';

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

const listToMerge = [
  { id: 'HIST-FARMATODO', razon_social: 'FARMATODO', rif: '', persona_contacto: '', telefono: '', correo: '' },
  { id: 298, razon_social: 'DROGUERIA FARMATODO, C.A.', rif: 'J-00020200-1', persona_contacto: 'Ana Gómez', telefono: '0261-7000000', correo: 'farmatodo@contacto.com', ciudad: 'Caracas' }
];

const dedupped = deduplicarListaProveedores(listToMerge);
console.log("\n=== RESULTADO DEDUPLICAR LISTA ===");
console.log(JSON.stringify(dedupped, null, 2));
