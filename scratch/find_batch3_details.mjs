import fs from 'fs';

const rawHist = JSON.parse(fs.readFileSync('scratch/historial_proveedores_completo.json', 'utf8'));
const rawExtr = JSON.parse(fs.readFileSync('scratch/proveedores_extraidos_actualizados.json', 'utf8'));

const terms = [
  'MORGADO',
  'VALBUENA',
  'ANDRADE',
  '50490259',
  'ISABELA',
  'IWECOTECH',
  'IWOSA',
  'J.A. SISTEMAS',
  'NAVA FACCINI',
  '11290860',
  'INVERMACO',
  'ADRIZORCA',
  'CHACHI',
  'GARCIAS RIVAS',
  'JF MURO',
  'HUBY',
  'HOBY',
  '8233-3',
  '50168233',
  'IMPORTADORA DE CAUCHO',
  'INDRINA',
  'HIDROBOMBAS'
];

console.log('=== SEARCH IN HISTORIAL ===');
terms.forEach(t => {
  const matches = rawHist.filter(h => JSON.stringify(h).toUpperCase().includes(t.toUpperCase()));
  console.log(`\nTerm: "${t}" -> Matches: ${matches.length}`);
  matches.forEach(m => {
    console.log(`  [${m.rif || 'Sin RIF'}] ${m.nombreOriginal || m.razon_social} | Tel: ${m.telefono} | Correo: ${m.correo} | Dir: ${m.direccion}`);
  });
});

console.log('\n=== SEARCH IN EXTRAIDOS ===');
terms.forEach(t => {
  const matches = rawExtr.filter(h => JSON.stringify(h).toUpperCase().includes(t.toUpperCase()));
  console.log(`\nTerm: "${t}" -> Matches: ${matches.length}`);
  matches.forEach(m => {
    console.log(`  [${m.rif || 'Sin RIF'}] ${m.razon_social} | Tel: ${m.telefono} | Correo: ${m.correo} | Dir: ${m.direccion}`);
  });
});
