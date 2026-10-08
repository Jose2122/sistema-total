import fs from 'fs';
const content = fs.readFileSync('src/Requisiciones.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('setFacturasUrls') || l.includes('facturasUrls') || l.includes('facturas_url')) {
    console.log(`Line ${idx + 1}: ${l.trim().substring(0, 130)}`);
  }
});
