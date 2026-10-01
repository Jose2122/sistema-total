import fs from 'fs';

const rawHist = JSON.parse(fs.readFileSync('scratch/historial_proveedores_completo.json', 'utf8'));
const rawExtr = JSON.parse(fs.readFileSync('scratch/proveedores_extraidos_actualizados.json', 'utf8'));

const terms = [
  '30045684', 'CAUCHOS SORA',
  '30089263', 'CACIQUE MANAURE',
  '30593070', 'EDICION INTEGRAL', 'EDICIÓN INTEGRAL',
  '29616859', 'PIRITU INN',
  '30713850', 'COFTAH',
  '50034104', 'MARRERO',
  'BATOR', '31601550',
  'BICOLOR', '07017217',
  'BLANCA NIEVES', '11582145',
  'SANTA ROSA', '40004091',
  'BRIAN J ZAMBRANO',
  'CAUCHO VERITAS',
  'LAS DELICIAS', '30726213',
  'ALVAREZ ALVAREZ', '50254615',
  'ANDRY GONZALEZ', '20370510',
  'AP TRUCK', '50488657',
  'ASERRADERO ORENSE',
  'SOLUCIONES GENERALES', '29780707',
  'AUTO PARTES EH', '40558032',
  'AIR MAX', '50582768',
  'ARENDS', '07826676',
  'GARCIA QUINTERO', '09730875',
  'HUERTA OLIVARES', '18987383',
  'ALKOSTO', '58695231',
  'A&H SUPPLY', '40454759',
  'FRAN COLORS', '31559921'
];

terms.forEach(t => {
  const mHist = rawHist.filter(h => JSON.stringify(h).toUpperCase().includes(t.toUpperCase()));
  const mExtr = rawExtr.filter(h => JSON.stringify(h).toUpperCase().includes(t.toUpperCase()));
  if (mHist.length || mExtr.length) {
    console.log(`\nMatch for "${t}":`);
    mHist.forEach(m => console.log(`  [HIST] [${m.rif || 'Sin RIF'}] ${m.nombreOriginal || m.razon_social} | Tel: ${m.telefono} | Correo: ${m.correo}`));
    mExtr.forEach(m => console.log(`  [EXTR] [${m.rif || 'Sin RIF'}] ${m.razon_social} | Tel: ${m.telefono} | Correo: ${m.correo} | Dir: ${m.direccion}`));
  }
});
