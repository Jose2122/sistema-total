import fs from 'fs';

const rawExtr = JSON.parse(fs.readFileSync('scratch/proveedores_extraidos_actualizados.json', 'utf8'));

const iSuppliers = rawExtr.filter(p => (p.razon_social || '').toUpperCase().startsWith('I') || (p.razon_social || '').toUpperCase().startsWith('J'));

console.log(`Found ${iSuppliers.length} suppliers starting with I or J:`);
iSuppliers.forEach(p => {
  console.log(`- [${p.rif || 'Sin RIF'}] ${p.razon_social}`);
});
