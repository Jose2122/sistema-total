const fs = require('fs');
const content = fs.readFileSync('c:/Users/kmachado/sistema-compras/src/Requisiciones.jsx', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (idx > 1850 && idx < 2000 && (line.includes('return (') || line.includes('return('))) {
    console.log(`Line ${idx+1}: ${line}`);
    for(let i=idx; i<idx+30; i++) {
      console.log(`   [${i+1}] ${lines[i]}`);
    }
  }
});
