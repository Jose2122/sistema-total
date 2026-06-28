const fs = require('fs');

const files = [
  'c:/Users/kmachado/sistema-compras/src/ModuloTicketsPago.jsx',
  'c:/Users/kmachado/sistema-compras/src/SolicitudFondos.jsx',
  'c:/Users/kmachado/sistema-compras/src/Requisiciones.jsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    console.log(`--- File: ${file} ---`);
    lines.forEach((line, idx) => {
      if (line.includes('<h1') || (line.includes('fontSize:') && (line.includes('1.5rem') || line.includes('2rem') || line.includes('1.8rem') || line.includes('2.2rem') || line.includes('2.5rem')))) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
        // Print 3 lines before and after
        for (let i = Math.max(0, idx - 3); i <= Math.min(lines.length - 1, idx + 3); i++) {
          console.log(`   [${i+1}] ${lines[i]}`);
        }
      }
    });
  }
}
