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
      if (line.includes('<h1') || line.includes('<h2') || line.includes('fontSize:') || line.includes('titulo') || line.includes('Gestión de') || line.includes('Gestión centralizada')) {
        if (line.includes('return') || line.includes('<') || line.includes('style=')) {
          console.log(`Line ${idx + 1}: ${line.trim()}`);
        }
      }
    });
  }
}
