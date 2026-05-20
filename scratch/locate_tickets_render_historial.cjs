const fs = require('fs');
const content = fs.readFileSync('c:/Users/kmachado/sistema-compras/src/ModuloTicketsPago.jsx', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('const renderHistorial =')) {
    console.log(`Line ${idx+1}: ${line}`);
    for(let i=idx; i<idx+80; i++) {
      console.log(`   [${i+1}] ${lines[i]}`);
    }
  }
});
