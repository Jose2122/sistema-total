import fs from 'fs';
const list = JSON.parse(fs.readFileSync('scratch/proveedores_extraidos_actualizados.json', 'utf8'));
list.forEach(p => {
  if (JSON.stringify(p).includes('03684176') || JSON.stringify(p).toUpperCase().includes('BOSQUE')) {
    console.log('Match:', p);
  }
});
