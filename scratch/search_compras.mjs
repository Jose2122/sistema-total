import fs from 'fs';

const content = fs.readFileSync('src/Compras.jsx', 'utf8');
const lines = content.split('\n');

console.log('Searching in Compras.jsx:');
lines.forEach((l, idx) => {
  if (
    l.includes('setFacturasUrls') ||
    l.includes('facturas_url') ||
    l.includes('facturasUrls') ||
    l.includes('iniciarProcesamiento') ||
    l.includes('seleccionarRequisicion') ||
    l.includes('abrirModal') ||
    l.includes('guardarCompra') ||
    l.includes('guardarRenglones') ||
    l.includes('handleFileChange') ||
    l.includes('adjuntar') ||
    l.includes('adjunto')
  ) {
    console.log(`Line ${idx + 1}: ${l.trim().substring(0, 120)}`);
  }
});
